from __future__ import annotations

from typing import List
from fastapi import APIRouter

from ....schemas.quarantaine import QuarantaineOut
from ....services.store import DepotPostgres

router = APIRouter()
depot = DepotPostgres()


@router.get("/quarantaine", response_model=List[QuarantaineOut])
def lister_quarantaine():
    return depot.quarantaine()


@router.delete("/quarantaine")
def vider_quarantaine():
    depot.vider_quarantaine()
    return {"message": "La file de quarantaine a été vidée."}
