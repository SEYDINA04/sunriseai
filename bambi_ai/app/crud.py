from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Voicemail


async def upsert_user(db: AsyncSession, telegram_id: int, username: str | None) -> User:
    stmt = (
        insert(User)
        .values(telegram_id=telegram_id, username=username or "", language="twi")
        .on_conflict_do_update(
            index_elements=["telegram_id"],
            set_={"username": username or ""},
        )
    )
    await db.execute(stmt)
    await db.commit()
    return await db.get(User, telegram_id)


async def set_user_language(db: AsyncSession, telegram_id: int, language: str) -> None:
    user = await db.get(User, telegram_id)
    if user:
        user.language = language
        await db.commit()


async def get_user_language(db: AsyncSession, telegram_id: int) -> str:
    user = await db.get(User, telegram_id)
    return user.language if user else "twi"


async def get_telegram_id_by_username(db: AsyncSession, username: str) -> int | None:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    return user.telegram_id if user else None


async def save_voicemail(
    db: AsyncSession,
    sender_id: int,
    sender_username: str,
    recipient_username: str,
    audio_path: str,
    transcript: str | None,
    language: str,
) -> Voicemail:
    vm = Voicemail(
        sender_id=sender_id,
        sender_username=sender_username,
        recipient_username=recipient_username,
        audio_path=audio_path,
        transcript=transcript,
        language=language,
        created_at=datetime.utcnow(),
    )
    db.add(vm)
    await db.commit()
    await db.refresh(vm)
    return vm


async def get_pending_voicemails(db: AsyncSession, recipient_username: str) -> list[Voicemail]:
    result = await db.execute(
        select(Voicemail)
        .where(Voicemail.recipient_username == recipient_username, Voicemail.delivered == False)
        .order_by(Voicemail.created_at)
    )
    return list(result.scalars().all())


async def mark_delivered(db: AsyncSession, voicemail_id: int) -> None:
    vm = await db.get(Voicemail, voicemail_id)
    if vm:
        vm.delivered = True
        await db.commit()
