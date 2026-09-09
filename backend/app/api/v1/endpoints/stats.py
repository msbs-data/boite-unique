from __future__ import annotations

from pathlib import Path
from fastapi import APIRouter

from ....core.config import settings
from ....schemas.stats import StatsCompteursOut
from ....services.store import DepotPostgres

router = APIRouter()
depot = DepotPostgres()


def _restants_count() -> int:
    entrant = settings.entrant_path
    if not entrant.exists():
        return 0
    releves_dir = settings.data_path / ".releves"
    restants = 0
    for fichier in entrant.glob("*.eml"):
        marque = releves_dir / fichier.name
        if not marque.exists():
            restants += 1
    return restants


@router.get("/stats", response_model=StatsCompteursOut)
def get_stats():
    c = depot.compteurs()
    c["restants"] = _restants_count()
    return c
