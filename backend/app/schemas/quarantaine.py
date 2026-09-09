from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, ConfigDict


class QuarantaineOut(BaseModel):
    id: int
    nom_fichier: str
    recue_le: str
    expediteur: Optional[str] = None
    adresses_examinees: str
    motif: str

    model_config = ConfigDict(from_attributes=True)
