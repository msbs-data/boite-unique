from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from ....schemas.facturation import (
    AttributionIn, FactureOut, GenererIn, IdsIn, LigneReleveOut, SyntheseOut,
    TauxIn, TempsCreate, TempsOut, TempsUpdate,
)
from ....services.facturation import Depot

router = APIRouter()
depot = Depot()


@router.get("/facturation/synthese", response_model=SyntheseOut,
            summary="Temps par client, coût horaire et montant du mois")
def synthese(periode: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$")):
    return depot.synthese(periode)


@router.get("/facturation/temps", response_model=List[TempsOut], summary="Lignes de temps saisies")
def lister_temps(periode: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
                 dossier: str = ""):
    return depot.temps(periode, dossier)


@router.post("/facturation/temps", response_model=dict,
             status_code=status.HTTP_201_CREATED, summary="Pointer du temps")
def saisir_temps(entree: TempsCreate):
    try:
        return {"id": depot.saisir_temps(entree.dossier_code, entree.jour, entree.heures,
                                         entree.taux_horaire, entree.libelle, entree.saisi_par)}
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err


@router.put("/facturation/temps/{ligne_id}", summary="Corriger une ligne non facturée")
def modifier_temps(ligne_id: int, entree: TempsUpdate):
    try:
        return depot.modifier_temps(ligne_id, entree.heures, entree.taux_horaire,
                                    entree.jour, entree.libelle)
    except LookupError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err)) from err


@router.post("/facturation/taux", summary="Appliquer un coût horaire à un dossier")
def appliquer_taux(entree: TauxIn):
    try:
        return depot.appliquer_taux(entree.dossier_code, entree.taux_horaire, entree.periode)
    except LookupError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err


@router.post("/facturation/releve/{ligne_id}/attribuer",
             summary="Rattacher ou détacher une ligne de relevé")
def attribuer(ligne_id: int, entree: AttributionIn):
    try:
        return depot.attribuer(ligne_id, entree.facture_id)
    except LookupError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err


@router.delete("/facturation/temps/{ligne_id}", summary="Supprimer une ligne non facturée")
def supprimer_temps(ligne_id: int):
    try:
        if not depot.supprimer_temps(ligne_id):
            raise HTTPException(status_code=404, detail="Ligne introuvable.")
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(err)) from err
    return {"supprimee": ligne_id}


@router.post("/facturation/generer", summary="Générer les factures du mois")
def generer(entree: GenererIn):
    return depot.generer(entree.periode, entree.dossiers)


@router.get("/facturation/factures", response_model=List[FactureOut], summary="Factures d'honoraires")
def lister_factures(periode: str = "", etat: str = ""):
    return depot.factures(periode, etat)


@router.post("/facturation/factures/envoyer", summary="Marquer des factures comme envoyées")
def envoyer(entree: IdsIn):
    return depot.envoyer(entree.ids)


@router.post("/facturation/factures/relancer", summary="Enregistrer une relance")
def relancer(entree: IdsIn):
    return depot.relancer(entree.ids)


@router.get("/facturation/releve", response_model=List[LigneReleveOut], summary="Relevé bancaire")
def releve():
    return depot.releve()


@router.post("/facturation/releve/simuler",
             summary="Démonstration : simuler l'arrivée du relevé bancaire")
def simuler_releve():
    return depot.simuler_releve()


@router.post("/facturation/rapprocher", summary="Rapprocher le relevé et les factures")
def rapprocher():
    return depot.rapprocher()
