from __future__ import annotations

from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from ..core.database import Base


class Dossier(Base):
    __tablename__ = "dossier"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False, index=True)
    raison_sociale = Column(String(255), nullable=False)
    alias = Column(String(255), unique=True, nullable=False, index=True)
    actif = Column(Boolean, default=True, nullable=False)

    pieces = relationship("Piece", back_populates="dossier", cascade="all, delete-orphan")
