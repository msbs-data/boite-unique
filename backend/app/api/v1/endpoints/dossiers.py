from __future__ import annotations

from typing import List
from fastapi import APIRouter, HTTPException, status

from ....schemas.dossier import DossierCreate, DossierOut
from ....services.store import DepotPostgres

router = APIRouter()
depot = DepotPostgres()


@router.get("/dossiers", response_model=List[DossierOut])
def lister_dossiers():
    return depot.dossiers()


@router.post("/dossiers", response_model=DossierOut, status_code=status.HTTP_201_CREATED)
def creer_dossier(dossier_in: DossierCreate):
    code_propre = dossier_in.code.strip().upper()
    alias_propre = dossier_in.alias.strip().lower()
    raison_propre = dossier_in.raison_sociale.strip()

    if not code_propre or not raison_propre or not alias_propre:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code, la raison sociale et l'alias sont obligatoires.",
        )

    # Check existence
    existants = depot.dossiers()
    if any(d["code"] == code_propre for d in existants):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un dossier avec le code '{code_propre}' existe déjà.",
        )
    if any(d["alias"] == alias_propre for d in existants):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un dossier avec l'alias '{alias_propre}' existe déjà.",
        )

    depot.ajouter_dossier(code_propre, raison_propre, alias_propre)
    nouveau = next((d for d in depot.dossiers() if d["code"] == code_propre), None)
    if not nouveau:
        raise HTTPException(status_code=500, detail="Erreur lors de la création du dossier.")
    return nouveau
