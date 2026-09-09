from __future__ import annotations

import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from .config import settings

logger = logging.getLogger("boite_unique.database")

Base = declarative_base()

def get_engine():
    db_url = settings.sync_database_url
    connect_args = {}
    if db_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        return create_engine(db_url, connect_args=connect_args)
    return create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables if they don't exist."""
    # Import all models before creating tables
    from ..models import dossier, piece, extraction, quarantaine, export, facturation, paie  # noqa: F401
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified and initialized.")
    except Exception as e:
        logger.error(f"Error initializing database tables: {e}")
        raise
