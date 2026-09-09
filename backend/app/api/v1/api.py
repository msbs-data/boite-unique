from __future__ import annotations

from fastapi import APIRouter

from .endpoints import (
    actions, dossiers, exports, facturation, health, paie, pieces, quarantaine, stats,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(stats.router, tags=["Statistiques & Compteurs"])
api_router.include_router(dossiers.router, tags=["Dossiers"])
api_router.include_router(pieces.router, tags=["Pièces Comptables"])
api_router.include_router(actions.router, tags=["Actions"])
api_router.include_router(quarantaine.router, tags=["Quarantaine"])
api_router.include_router(exports.router, tags=["Exports Sage"])
api_router.include_router(facturation.router, tags=["Facturation client"])
api_router.include_router(paie.router, tags=["Paie — collecte des variables"])
