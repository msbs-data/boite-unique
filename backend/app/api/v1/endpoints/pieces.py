from __future__ import annotations

from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Response, status

from ....core.config import settings
from ....schemas.piece import PieceOut, PieceValidation
from ....services.store import DepotPostgres

router = APIRouter()
depot = DepotPostgres()

MIME_TYPES = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".heic": "image/heic",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
}


@router.get("/pieces", response_model=List[PieceOut])
def lister_pieces(
    q: Optional[str] = Query(default="", description="Recherche textuelle"),
    etat: Optional[str] = Query(default="", description="Filtre état (lue, a_verifier, exportee)"),
    dossier: Optional[str] = Query(default="", description="Filtre code dossier"),
):
    return depot.pieces(requete=q or "", etat=etat or "", dossier=dossier or "")


@router.get("/pieces/{piece_id}", response_model=PieceOut)
def detail_piece(piece_id: int):
    piece = depot.piece(piece_id)
    if not piece:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pièce introuvable.")
    return piece


@router.post("/pieces/{piece_id}/valider")
def valider_piece(piece_id: int, payload: PieceValidation = PieceValidation()):
    piece = depot.piece(piece_id)
    if not piece:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pièce introuvable.")
    validateur = payload.validee_par or settings.UTILISATEUR
    depot.valider(piece_id, validateur)
    return {"message": "Pièce validée avec succès.", "piece_id": piece_id, "validee_par": validateur}


@router.get("/pieces/{piece_id}/fichier")
def telecharger_ou_visualiser_fichier(piece_id: int):
    piece = depot.piece(piece_id)
    if not piece or not piece.get("chemin_image"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pièce sans fichier associé.")

    # Prevent path traversal vulnerabilities by taking strictly the filename and verifying resolution
    nom_fichier_stocke = Path(piece["chemin_image"]).name
    chemin = (settings.images_path / nom_fichier_stocke).resolve()
    base_dir = settings.images_path.resolve()

    if not chemin.is_relative_to(base_dir) or not chemin.exists() or not chemin.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier introuvable sur le disque.")

    media_type = MIME_TYPES.get(chemin.suffix.lower(), "application/octet-stream")
    nom_public = Path(piece.get("nom_fichier") or "piece").name

    return Response(
        content=chemin.read_bytes(),
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{nom_public}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
