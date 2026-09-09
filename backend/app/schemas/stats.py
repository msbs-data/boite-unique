from __future__ import annotations

from pydantic import BaseModel


class StatsCompteursOut(BaseModel):
    pieces: int
    lues: int
    a_verifier: int
    exportees: int
    structurees: int
    quarantaine: int
    dossiers: int
    restants: int
