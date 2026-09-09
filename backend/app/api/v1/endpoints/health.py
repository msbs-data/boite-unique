from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from ....core.config import settings
from ....core.database import SessionLocal

router = APIRouter()


@router.get("/health")
def health_check():
    db_status = "ok"
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unavailable: {e}"

    return {
        "status": "healthy" if db_status == "ok" else "degraded",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }
