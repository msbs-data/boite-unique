from __future__ import annotations

import shutil
from email.message import EmailMessage
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from ....core.config import settings
from ....services.ingest import SUFFIXES_STOCKES, traiter_mail
from ....services.samples_bootstrap import amorcer, amorcer_facturation
from ....services.store import DepotPostgres

router = APIRouter()
depot = DepotPostgres()

SUFFIXES_ACCEPTES = {
    ".eml", ".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff", ".txt", ".xml", ".csv"
}


def _restants_fichiers() -> List[Path]:
    entrant = settings.entrant_path
    if not entrant.exists():
        return []
    releves_dir = settings.data_path / ".releves"
    restants = []
    for fichier in sorted(entrant.glob("*.eml")):
        marque = releves_dir / fichier.name
        if not marque.exists():
            restants.append(fichier)
    return restants


def _marquer_releve(fichier: Path) -> None:
    releves_dir = settings.data_path / ".releves"
    releves_dir.mkdir(parents=True, exist_ok=True)
    (releves_dir / fichier.name).write_text("relevé", encoding="utf-8")


@router.post("/actions/recevoir")
def recevoir_emails(tout: bool = False):
    restants = _restants_fichiers()
    if not restants:
        return {"message": "Aucun nouveau message à relever.", "traites": 0, "details": []}

    a_traiter = restants if tout else restants[:1]
    resultats = []
    for fichier in a_traiter:
        compte = traiter_mail(
            fichier.read_bytes(), depot, settings.attrape_tout, settings.images_path
        )
        _marquer_releve(fichier)
        resultats.append({"fichier": fichier.name, "resultat": compte})

    return {
        "message": f"{len(resultats)} message(s) traité(s) avec succès.",
        "traites": len(resultats),
        "details": resultats,
    }


@router.post("/actions/deposer")
async def deposer_fichier(
    fichier: UploadFile = File(...),
    dossier: Optional[str] = Form(default=None),
):
    contenu = await fichier.read(settings.MAX_UPLOAD_SIZE_BYTES + 1)
    if len(contenu) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Le fichier dépasse la taille maximale autorisée ({settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} Mo).",
        )

    nom_brut = fichier.filename or "depot"
    nom = Path(nom_brut).name  # sanitize to filename only
    suffixe = Path(nom).suffix.lower()

    if suffixe not in SUFFIXES_ACCEPTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format de fichier '{suffixe}' non accepté. Formats autorisés : {', '.join(sorted(SUFFIXES_ACCEPTES))}",
        )

    if suffixe == ".eml":
        res = traiter_mail(contenu, depot, settings.attrape_tout, settings.images_path)
        return {"message": "Email .eml traité.", "resultat": res}

    # Direct document deposit requires an existing dossier
    if not dossier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code dossier est obligatoire pour déposer directement une facture ou une image.",
        )

    dossiers_connus = depot.dossiers()
    alias = next((d["alias"] for d in dossiers_connus if d["code"] == dossier.strip().upper()), None)
    if not alias:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dossier client '{dossier}' introuvable.",
        )

    # Build simulated email envelope for direct upload
    msg = EmailMessage()
    msg["From"] = "depot-manuel@cabinet"
    msg["Subject"] = f"Dépôt manuel — {nom}"
    msg["X-Original-To"] = alias
    msg["To"] = alias
    msg.set_content("Pièce déposée depuis l'interface web.")

    content_type = fichier.content_type or "application/octet-stream"
    grand, _, petit = content_type.partition("/")
    msg.add_attachment(contenu, maintype=grand, subtype=petit or "octet-stream", filename=nom)

    res = traiter_mail(msg.as_bytes(), depot, settings.attrape_tout, settings.images_path)
    return {"message": f"Fichier '{nom}' déposé et traité pour le dossier {dossier}.", "resultat": res}


@router.post("/actions/reinitialiser")
def reinitialiser_demonstration():
    """Remet les données à zéro et réamorce les dossiers de référence."""
    depot.reinitialiser()

    # Clear generated images, exports and marks
    for chemin in (settings.images_path, settings.exports_path, settings.data_path / ".releves"):
        if chemin.is_dir():
            shutil.rmtree(chemin, ignore_errors=True)
            chemin.mkdir(parents=True, exist_ok=True)
        elif chemin.exists():
            chemin.unlink()

    # Re-seed default dossiers
    amorcer(depot)
    amorcer_facturation()
    return {"message": "La base de données et les fichiers de travail ont été réinitialisés avec succès."}
