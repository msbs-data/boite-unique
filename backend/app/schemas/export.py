from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict


class LigneSageOut(BaseModel):
    journal: str
    date_ecriture: str
    compte: str
    libelle: str
    debit: Optional[float] = None
    credit: Optional[float] = None
    numero_piece: str
    image: str


class ExportOut(BaseModel):
    id: int
    fait_le: str
    fichier: str
    nb_pieces: int
    pieces: List[int] = []

    model_config = ConfigDict(from_attributes=True)


class SageApercuOut(BaseModel):
    nb_pieces: int
    total_debit: float
    total_credit: float
    equilibre: bool
    lignes: List[LigneSageOut] = []
    csv_apercu: str
    derniers_exports: List[ExportOut] = []
