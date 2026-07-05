import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from telegram import BotCommand

from app.config import settings
from app.database import Base, engine
from app.redis_client import close_redis, init_redis
from app.routers import health, telegram
from app.services.bot import application, register_handlers

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    os.makedirs(settings.AUDIO_DIR, exist_ok=True)

    # Create tables (Alembic handles migrations in production; this covers dev cold-start)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await init_redis()
    log.info("Redis connected")

    await application.initialize()
    register_handlers()

    await application.bot.set_my_commands([
        BotCommand("start",  "Register and see what this bot can do"),
        BotCommand("lang",   "Set your language — twi or wolof"),
        BotCommand("send",   "Address a voicemail — /send @username, then record"),
        BotCommand("inbox",  "Play your unread voicemails"),
    ])
    log.info("Bot command menu registered")

    if settings.WEBHOOK_BASE_URL:
        webhook_url = f"{settings.WEBHOOK_BASE_URL}/webhook/{settings.TELEGRAM_BOT_TOKEN}"
        await application.bot.set_webhook(webhook_url)
        log.info("Telegram webhook set → %s", webhook_url)
    else:
        log.warning(
            "WEBHOOK_BASE_URL not set — Telegram webhook not registered. "
            "Set it in .env once you have a public HTTPS URL (ngrok works for local dev)."
        )

    yield

    # --- shutdown ---
    if settings.WEBHOOK_BASE_URL:
        await application.bot.delete_webhook()
    await application.shutdown()
    await close_redis()
    await engine.dispose()
    log.info("Clean shutdown complete")


app = FastAPI(
    title="Teeki AI Voicemail",
    description="Async voicemail over Telegram with Teeki AI ASR/TTS",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(telegram.router)
