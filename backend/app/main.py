from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from .core.config import settings
from .core.database import init_db
from .api.v1.api import api_router
from .services.store import DepotPostgres
from .services.samples_bootstrap import amorcer, amorcer_facturation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("boite_unique")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure directories exist and DB tables are initialized
    logger.info("Démarrage du backend La Boîte Unique...")
    settings.data_path.mkdir(parents=True, exist_ok=True)
    settings.entrant_path.mkdir(parents=True, exist_ok=True)
    settings.images_path.mkdir(parents=True, exist_ok=True)
    settings.exports_path.mkdir(parents=True, exist_ok=True)

    try:
        init_db()
        depot = DepotPostgres()
        if not depot.dossiers():
            logger.info("Amorçage des dossiers clients initiaux...")
            amorcer(depot)

        amorcer_facturation()

        # Si aucune pièce en base, amorçage automatique des pièces & factures de démo
        if depot.compteurs().get("pieces", 0) == 0:
            logger.info("Amorçage automatique des pièces comptables d'exemple...")
            try:
                import sys
                from pathlib import Path
                samples_path = Path("/srv/samples")
                if not samples_path.exists():
                    samples_path = Path(__file__).resolve().parent.parent.parent / "samples"
                if str(samples_path) not in sys.path:
                    sys.path.insert(0, str(samples_path))
                import make_samples
                make_samples.main()
                from .api.v1.endpoints.actions import recevoir_emails
                recevoir_emails(tout=True)
                logger.info("Pièces comptables et photos d'exemples amorcées avec succès.")
            except Exception as e_samples:
                logger.warning(f"Amorçage des pièces d'exemple différé: {e_samples}")
    except Exception as e:
        logger.warning(f"Initialisation BD différée ou erreur (base non prête): {e}")

    yield
    logger.info("Arrêt du backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API FastAPI pour la gestion des pièces comptables, factures Factur-X et exports Sage.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": f"Bienvenue sur l'API {settings.PROJECT_NAME}",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }
