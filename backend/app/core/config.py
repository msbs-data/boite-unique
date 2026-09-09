from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    PROJECT_NAME: str = "La Boîte Unique"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # PostgreSQL Connection
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "cabinet"
    POSTGRES_PASSWORD: str = "cabinet_secret"
    POSTGRES_DB: str = "cabinet_db"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: Optional[str] = None

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    DATA_DIR: Optional[Path] = None

    # App business parameters
    DOMAINE: str = "cabinet-demo.fr"
    UTILISATEUR: str = "M. Loiseau"

    # Security & CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
    ]

    MAX_UPLOAD_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB

    @computed_field
    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field
    @property
    def data_path(self) -> Path:
        if self.DATA_DIR:
            return Path(self.DATA_DIR).resolve()
        return (self.BASE_DIR / "data").resolve()

    @computed_field
    @property
    def entrant_path(self) -> Path:
        return self.data_path / "entrant"

    @computed_field
    @property
    def images_path(self) -> Path:
        return self.data_path / "pieces"

    @computed_field
    @property
    def exports_path(self) -> Path:
        return self.data_path / "exports"

    @computed_field
    @property
    def attrape_tout(self) -> set[str]:
        return {
            f"pieces@{self.DOMAINE}",
            f"comptabilite@{self.DOMAINE}",
            f"postmaster@{self.DOMAINE}",
        }


settings = Settings()
