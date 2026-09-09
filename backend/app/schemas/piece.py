from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, ConfigDict


class ExtractionOut(BaseModel):
    confiance: float
    methode: str
    validee_par: Optional[str] = None
    champs: dict = {}

    model_config = ConfigDict(from_attributes=True)


class PieceOut(BaseModel):
    id: int
    dossier_id: int
    dossier_code: Optional[str] = None
    raison_sociale: Optional[str] = None
    nom_fichier: str
    empreinte: str
    recue_le: str
    source: str
    type: str
    etat: str
    expediteur: Optional[str] = None
    alias_vise: Optional[str] = None
    entete_retenu: Optional[str] = None
    chemin_image: Optional[str] = None

    # Extraction flat fields for direct UI table consumption
    numero: Optional[str] = None
    date_facture: Optional[str] = None
    fournisseur: Optional[str] = None
    tva_intracom: Optional[str] = None
    siren: Optional[str] = None
    montant_ht: Optional[str] = None
    montant_tva: Optional[str] = None
    montant_ttc: Optional[str] = None
    devise: Optional[str] = None
    profil: Optional[str] = None

    confiance: Optional[float] = None
    methode: Optional[str] = None
    validee_par: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PieceValidation(BaseModel):
    validee_par: Optional[str] = None
