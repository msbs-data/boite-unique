from __future__ import annotations

from sqlalchemy import Column, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from ..core.database import Base


class Extraction(Base):
    __tablename__ = "extraction"

    piece_id = Column(Integer, ForeignKey("piece.id", ondelete="CASCADE"), primary_key=True)
    champs = Column(JSON, nullable=False, default=dict)
    confiance = Column(Float, nullable=False, default=0.0)
    methode = Column(String(64), nullable=False)
    validee_par = Column(String(255), nullable=True)

    piece = relationship("Piece", back_populates="extraction")
