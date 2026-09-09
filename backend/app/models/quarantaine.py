from __future__ import annotations

from sqlalchemy import Column, Integer, String, Text

from ..core.database import Base


class Quarantaine(Base):
    __tablename__ = "quarantaine"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom_fichier = Column(String(255), nullable=False)
    recue_le = Column(String(64), nullable=False, index=True)
    expediteur = Column(String(255), nullable=True)
    adresses_examinees = Column(Text, nullable=False)
    motif = Column(String(255), nullable=False)
