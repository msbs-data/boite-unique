from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from ..core.database import Base


class Piece(Base):
    __tablename__ = "piece"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    dossier_id = Column(Integer, ForeignKey("dossier.id", ondelete="CASCADE"), nullable=False, index=True)
    nom_fichier = Column(String(255), nullable=False)
    empreinte = Column(String(64), nullable=False, index=True)
    recue_le = Column(String(64), nullable=False, index=True)
    source = Column(String(32), default="mail", nullable=False)
    type = Column(String(32), default="autre", nullable=False)
    etat = Column(String(32), default="a_verifier", nullable=False, index=True)
    expediteur = Column(String(255), nullable=True)
    alias_vise = Column(String(255), nullable=True)
    entete_retenu = Column(String(64), nullable=True)
    chemin_image = Column(String(255), nullable=True)

    dossier = relationship("Dossier", back_populates="pieces")
    extraction = relationship("Extraction", back_populates="piece", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("dossier_id", "empreinte", name="uq_piece_dossier_empreinte"),
    )
