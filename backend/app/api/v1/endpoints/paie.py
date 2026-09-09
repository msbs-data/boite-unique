from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ....services.paie import Depot

router = APIRouter()
depot = Depot()


class MessageIn(BaseModel):
    canal: str = Field(pattern=r"^(whatsapp|gmail|telegram)$")
    expediteur: str
    contenu: str = Field(min_length=1)
    dossier_code: Optional[str] = None
    periode: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}$")


class CorrectionIn(BaseModel):
    valeur: float


@router.get("/paie/messages", summary="Messages reçus et variables proposées")
def messages(periode: str = "", etat: str = ""):
    return depot.messages(periode, etat)


@router.post("/paie/messages", status_code=status.HTTP_201_CREATED,
             summary="Recevoir un message d'un client")
def recevoir(entree: MessageIn):
    return depot.recevoir(entree.canal, entree.expediteur, entree.contenu,
                          entree.dossier_code, entree.periode)


@router.put("/paie/variables/{variable_id}", summary="Corriger une variable proposée")
def corriger(variable_id: int, entree: CorrectionIn):
    try:
        return depot.corriger(variable_id, entree.valeur)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.post("/paie/messages/{message_id}/valider", summary="Valider les variables d'un message")
def valider(message_id: int):
    try:
        return depot.valider(message_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.post("/paie/messages/{message_id}/ecarter", summary="Écarter un message")
def ecarter(message_id: int):
    try:
        return depot.ecarter(message_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/paie/export", summary="Fichier des variables validées, pour le logiciel de paie")
def export(periode: str = ""):
    return depot.export_openpaye(periode or None)
