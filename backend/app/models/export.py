from __future__ import annotations

from sqlalchemy import Column, Integer, JSON, String

from ..core.database import Base


class Export(Base):
    __tablename__ = "export"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fait_le = Column(String(64), nullable=False, index=True)
    fichier = Column(String(255), nullable=False)
    nb_pieces = Column(Integer, nullable=False, default=0)
    pieces = Column(JSON, nullable=False, default=list)
