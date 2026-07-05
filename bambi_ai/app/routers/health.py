from fastapi import APIRouter

from app.database import engine
from app.redis_client import get_redis

router = APIRouter(tags=["ops"])


@router.get("/health")
async def health() -> dict:
    checks: dict[str, str] = {}

    try:
        async with engine.connect():
            pass
        checks["postgres"] = "ok"
    except Exception as exc:
        checks["postgres"] = f"error: {exc}"

    try:
        await get_redis().ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"

    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": status, **checks}
