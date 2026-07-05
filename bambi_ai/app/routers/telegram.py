import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.services.bot import application
from telegram import Update

log = logging.getLogger(__name__)
router = APIRouter(tags=["telegram"])


@router.post("/webhook/{token}")
async def telegram_webhook(token: str, request: Request) -> dict:
    if token != settings.TELEGRAM_BOT_TOKEN:
        log.warning("Webhook rejected — bad token from %s", request.client.host if request.client else "unknown")
        raise HTTPException(status_code=403, detail="Forbidden")

    data = await request.json()
    update = Update.de_json(data, application.bot)
    log.debug("Webhook update_id=%s type=%s", update.update_id, _update_type(update))
    asyncio.create_task(application.process_update(update))
    return {"ok": True}


def _update_type(update: Update) -> str:
    if update.message:
        msg = update.message
        for kind in ("voice", "text", "photo", "video", "document", "audio", "sticker"):
            if getattr(msg, kind, None):
                return f"message/{kind}"
        return "message/unknown"
    if update.callback_query:
        return "callback_query"
    return "other"
