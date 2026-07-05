"""
Teeki AI ASR + OpenAI TTS integration.

ASR  — POST /transcribe/twi  or  /transcribe/wo  (multipart, field: file)
TTS  — OpenAI /v1/audio/speech (model tts-1, format opus → Telegram-compatible .ogg)
       Disabled automatically when OPENAI_API_KEY is empty.
"""
import logging
import os
import random

import aiofiles
import aiohttp
from openai import AsyncOpenAI

from app.config import settings

log = logging.getLogger(__name__)

_LANG_TO_PATH: dict[str, str] = {"twi": "twi", "wolof": "wo"}

_MOCK_TRANSCRIPTS: dict[str, list[str]] = {
    "twi":   ["Wo ho te sɛn? Mefrɛ wo akyi.", "Meda wo ase, mɛfrɛ wo bio."],
    "wolof": ["Naka nga def? Dinaa la woo ci kanam.", "Jërëjëf, dinaa la ubbi bataaxal bi."],
}


async def transcribe_audio(audio_path: str, language: str) -> str:
    if settings.MOCK_MODE:
        result = random.choice(_MOCK_TRANSCRIPTS.get(language, _MOCK_TRANSCRIPTS["twi"]))
        log.debug("ASR mock language=%s", language)
        return result
    log.info("ASR request language=%s path=%s", language, audio_path)
    return await _call_asr(audio_path, language)


async def synthesize_speech(text: str, _language: str) -> str | None:
    if not text or not settings.OPENAI_API_KEY or settings.MOCK_MODE:
        log.debug("TTS skipped mock=%s key_set=%s", settings.MOCK_MODE, bool(settings.OPENAI_API_KEY))
        return None
    log.info("TTS request chars=%d", len(text))
    return await _call_tts(text)


async def _call_tts(text: str) -> str | None:
    try:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text,
            response_format="opus",  # .ogg — accepted by Telegram reply_voice
        )
        out_path = os.path.join(settings.AUDIO_DIR, f"tts_{os.urandom(8).hex()}.ogg")
        async with aiofiles.open(out_path, "wb") as f:
            await f.write(response.content)
        log.info("TTS done path=%s bytes=%d", out_path, len(response.content))
        return out_path
    except Exception as exc:
        log.warning("TTS failed, falling back to text-only: %s", exc)
        return None


async def _call_asr(audio_path: str, language: str) -> str:
    path_segment = _LANG_TO_PATH.get(language)
    if not path_segment:
        raise ValueError(f"Unsupported language: {language!r}. Supported: {list(_LANG_TO_PATH)}")

    url = f"{settings.TEEKI_BASE_URL.rstrip('/')}/transcribe/{path_segment}"

    async with aiofiles.open(audio_path, "rb") as f:
        audio_bytes = await f.read()

    form = aiohttp.FormData()
    form.add_field(
        "file",
        audio_bytes,
        filename=os.path.basename(audio_path),
        content_type="application/octet-stream",
    )

    async with aiohttp.ClientSession() as session:
        async with session.post(url, data=form, timeout=aiohttp.ClientTimeout(total=30)) as resp:
            resp.raise_for_status()
            data = await resp.json()
            log.debug("ASR response status=%s body=%s", resp.status, data)

    transcript = data.get("text") or data.get("transcript") or data.get("transcription")
    if transcript is None:
        raise ValueError(f"Unexpected ASR response shape: {data}")
    return transcript
