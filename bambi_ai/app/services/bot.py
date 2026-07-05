"""
Telegram bot command/message handlers.

Redis usage:
  pending_recipient:{user_id}  — who the next voice note is addressed to (TTL 1h)
  user_lang:{user_id}          — cached language preference (write-through, TTL 24h)
  user_tg_id:{username}        — cached Telegram ID reverse-lookup (TTL 24h)
"""
import logging
import os

from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from app.config import settings
from app.database import AsyncSessionLocal
from app.redis_client import get_redis
import app.crud as crud
import app.speech as speech

log = logging.getLogger(__name__)

PENDING_RECIPIENT_TTL = 3600       # 1 hour
USER_LANG_TTL         = 86_400     # 24 hours
USER_TG_ID_TTL        = 86_400     # 24 hours

application: Application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).updater(None).build()


# --- Redis-backed helpers ---------------------------------------------------

async def _get_language(user_id: int) -> str:
    key = f"user_lang:{user_id}"
    cached = await get_redis().get(key)
    if cached:
        return cached
    async with AsyncSessionLocal() as db:
        lang = await crud.get_user_language(db, user_id)
    await get_redis().set(key, lang, ex=USER_LANG_TTL)
    return lang


async def _set_language(user_id: int, language: str) -> None:
    async with AsyncSessionLocal() as db:
        await crud.set_user_language(db, user_id, language)
    await get_redis().set(f"user_lang:{user_id}", language, ex=USER_LANG_TTL)


async def _get_tg_id(username: str) -> int | None:
    key = f"user_tg_id:{username}"
    cached = await get_redis().get(key)
    if cached:
        return int(cached)
    async with AsyncSessionLocal() as db:
        tg_id = await crud.get_telegram_id_by_username(db, username)
    if tg_id is not None:
        await get_redis().set(key, str(tg_id), ex=USER_TG_ID_TTL)
    return tg_id


async def _cache_user(user_id: int, username: str | None, language: str = "twi") -> None:
    """Warm both caches when a user registers or sends their first message."""
    if username:
        await get_redis().set(f"user_tg_id:{username}", str(user_id), ex=USER_TG_ID_TTL)
    await get_redis().set(f"user_lang:{user_id}", language, ex=USER_LANG_TTL)


# --- Handlers ---------------------------------------------------------------

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    async with AsyncSessionLocal() as db:
        db_user = await crud.upsert_user(db, user.id, user.username)
    await _cache_user(user.id, user.username, db_user.language)
    log.info("/start user_id=%s username=%s language=%s", user.id, user.username, db_user.language)
    await update.message.reply_text(
        f"Welcome to Bambi AI Voicemail, @{user.username or user.id}!\n\n"
        "• /lang twi  or  /lang wolof — set your language\n"
        "• /send @username — then record a voice note to leave them a voicemail\n"
        "• /inbox — check messages left for you\n\n"
        "Note: the recipient must have messaged this bot at least once "
        "(so it can look up their username)."
    )


async def cmd_set_lang(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("Usage: /lang twi  (or /lang wolof)")
        return
    language = context.args[0].lower()
    await _set_language(update.effective_user.id, language)
    log.info("/lang user_id=%s language=%s", update.effective_user.id, language)
    await update.message.reply_text(f"Language set to {language}.")


async def cmd_send(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("Usage: /send @username, then send a voice note.")
        return
    recipient = context.args[0].lstrip("@")
    await get_redis().set(f"pending_recipient:{update.effective_user.id}", recipient, ex=PENDING_RECIPIENT_TTL)
    log.info("/send user_id=%s → recipient=%s", update.effective_user.id, recipient)
    await update.message.reply_text(
        f"Ready — record a voice note now and I'll deliver it to @{recipient}."
    )


async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    sender = update.effective_user
    redis = get_redis()

    recipient = await redis.get(f"pending_recipient:{sender.id}")
    if not recipient:
        log.debug("voice from user_id=%s but no pending recipient — ignored", sender.id)
        await update.message.reply_text(
            "Who is this voicemail for? Use /send @username first, then record."
        )
        return

    voice = update.message.voice
    log.info(
        "voice received user_id=%s → recipient=%s duration=%ss file_id=%s",
        sender.id, recipient, voice.duration, voice.file_id,
    )
    tg_file = await context.bot.get_file(voice.file_id)
    audio_path = os.path.join(settings.AUDIO_DIR, f"{voice.file_unique_id}.ogg")
    await tg_file.download_to_drive(audio_path)
    log.debug("audio saved path=%s", audio_path)

    # Both of these hit Redis first, DB only on cache miss
    language = await _get_language(sender.id)
    recipient_tg_id = await _get_tg_id(recipient)
    log.debug("resolved language=%s recipient_tg_id=%s", language, recipient_tg_id)

    transcript = await speech.transcribe_audio(audio_path, language)
    log.info("transcript language=%s text=%r", language, transcript)

    async with AsyncSessionLocal() as db:
        await crud.save_voicemail(
            db,
            sender_id=sender.id,
            sender_username=sender.username or str(sender.id),
            recipient_username=recipient,
            audio_path=audio_path,
            transcript=transcript,
            language=language,
        )
    log.info("voicemail saved sender=%s recipient=%s", sender.id, recipient)

    await redis.delete(f"pending_recipient:{sender.id}")

    await update.message.reply_text(
        f"Voicemail queued for @{recipient}.\nTranscript ({language}): \"{transcript}\""
    )

    reply_audio = await speech.synthesize_speech(
        f"Your voicemail for @{recipient} has been recorded and will be delivered.", language
    )
    if reply_audio:
        with open(reply_audio, "rb") as f:
            await update.message.reply_voice(f)

    if recipient_tg_id:
        try:
            await context.bot.send_message(
                recipient_tg_id,
                f"🎙 New voicemail from @{sender.username or sender.id}. Run /inbox to hear it.",
            )
        except Exception as exc:
            log.warning("Could not proactively notify recipient: %s", exc)


async def cmd_inbox(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user.username:
        await update.message.reply_text(
            "You need a Telegram @username (Settings > Username) so others can find your inbox."
        )
        return

    async with AsyncSessionLocal() as db:
        pending = await crud.get_pending_voicemails(db, user.username)
        log.info("/inbox user_id=%s username=%s pending=%d", user.id, user.username, len(pending))
        if not pending:
            await update.message.reply_text("No new voicemails.")
            return
        for vm in pending:
            caption = f"From @{vm.sender_username} ({vm.language}):\n\"{vm.transcript}\""
            with open(vm.audio_path, "rb") as f:
                await update.message.reply_voice(f, caption=caption)
            await crud.mark_delivered(db, vm.id)
            log.debug("delivered voicemail id=%s from=%s", vm.id, vm.sender_username)


def register_handlers() -> None:
    application.add_handler(CommandHandler("start", cmd_start))
    application.add_handler(CommandHandler("lang", cmd_set_lang))
    application.add_handler(CommandHandler("send", cmd_send))
    application.add_handler(CommandHandler("inbox", cmd_inbox))
    application.add_handler(MessageHandler(filters.VOICE, handle_voice))
