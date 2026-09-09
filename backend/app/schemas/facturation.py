from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TempsCreate(BaseModel):
    dossier_code: str
    jour: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    heures: float = Field(gt=0, le=24)
    taux_horaire: Optional[float] = Field(default=None, gt=0)
    libelle: Optional[str] = None
    saisi_par: Optional[str] = None


class TempsOut(BaseModel):
    id: int
    dossier_code: str
    raison_sociale: str
    jour: str
    heures: float
    taux_horaire: float
    montant: float
    libelle: Optional[str] = None
    saisi_par: Optional[str] = None
    facturee: bool
    facture_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


class SemaineOut(BaseModel):
    semaine: str
    du: str
    heures: float
    montant: float


class LigneSyntheseOut(BaseModel):
    dossier_code: str
    raison_sociale: str
    heures: float
    taux_horaire: float
    montant_ht: float
    heures_a_facturer: float
    montant_a_facturer: float
    jours: float
    semaines: List[SemaineOut]
    facture_numero: Optional[str] = None
    facture_etat: Optional[str] = None


class SyntheseOut(BaseModel):
    periode: str
    lignes: List[LigneSyntheseOut]
    total_heures: float
    total_ht: float
    total_tva: float
    total_ttc: float
    total_a_facturer: float
    dossiers_pointes: int


class FactureOut(BaseModel):
    id: int
    numero: str
    dossier_code: str
    raison_sociale: str
    alias: Optional[str] = None
    periode: str
    emise_le: str
    echeance_le: str
    heures: float
    montant_ht: float
    montant_tva: float
    montant_ttc: float
    etat: str
    envoyee_le: Optional[str] = None
    envoyee_a: Optional[str] = None
    relances: int
    montant_encaisse: float
    reste_du: float
    jours_retard: int
    model_config = ConfigDict(from_attributes=True)


class LigneReleveOut(BaseModel):
    id: int
    jour: str
    libelle: str
    montant: float
    reference: Optional[str] = None
    rapprochement: str
    facture_numero: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class GenererIn(BaseModel):
    periode: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}$")
    dossiers: Optional[List[str]] = None


class IdsIn(BaseModel):
    ids: List[int] = Field(min_length=1)
