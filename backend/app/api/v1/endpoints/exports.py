from __future__ import annotations

from pathlib import Path
from typing import List
from fastapi import APIRouter, HTTPException, Response, status

from ....core.config import settings
from ....schemas.export import ExportOut, LigneSageOut, SageApercuOut
from ....services.sage import ProfilSage, construire, rendre_csv
from ....services.store import DepotPostgres

router = APIRouter()
depot = DepotPostgres()


@router.get("/exports", response_model=List[ExportOut])
def lister_exports():
    return depot.exports()


@router.get("/exports/apercu", response_model=SageApercuOut)
def apercu_export():
    pieces_lues = depot.pieces(etat="lue")
    profil = ProfilSage()
    exp = construire(pieces_lues, profil)
    csv_bytes = rendre_csv(exp, profil)
    derniers = depot.exports()[:5]

    lignes_out = [
        LigneSageOut(
            journal=l.journal,
            date_ecriture=l.date_piece.strftime(profil.format_date),
            compte=l.compte,
            libelle=l.libelle,
            debit=float(l.debit) if l.debit is not None else None,
            credit=float(l.credit) if l.credit is not None else None,
            numero_piece=l.piece,
            image=l.image,
        )
        for l in exp.lignes
    ]

    return SageApercuOut(
        nb_pieces=len(exp.pieces),
        total_debit=float(exp.total_debit),
        total_credit=float(exp.total_credit),
        equilibre=exp.equilibre,
        lignes=lignes_out,
        csv_apercu=csv_bytes.decode("cp1252", errors="replace")[:4000],
        derniers_exports=derniers,
    )


@router.post("/exports/generer", response_model=ExportOut)
def generer_export():
    pieces_lues = depot.pieces(etat="lue")
    if not pieces_lues:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucune pièce lue à exporter.",
        )

    profil = ProfilSage()
    exp = construire(pieces_lues, profil)
    if not exp.lignes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Les pièces lues ne contiennent aucune écriture comptable valide.",
        )

    settings.exports_path.mkdir(parents=True, exist_ok=True)
    fichier_csv = settings.exports_path / Path(exp.fichier).name
    fichier_csv.write_bytes(rendre_csv(exp, profil))

    depot.marquer_exportees(exp.pieces, exp.fichier)

    # Return latest export
    derniers = depot.exports()
    return derniers[0] if derniers else ExportOut(id=0, fait_le="", fichier=exp.fichier, nb_pieces=len(exp.pieces), pieces=exp.pieces)


@router.get("/exports/{nom}/telecharger")
def telecharger_export(nom: str):
    # Sanitize filename strictly to prevent directory traversal
    nom_propre = Path(nom).name
    chemin = (settings.exports_path / nom_propre).resolve()
    base_dir = settings.exports_path.resolve()

    if not chemin.is_relative_to(base_dir) or not chemin.exists() or not chemin.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier d'export introuvable.")

    return Response(
        chemin.read_bytes(),
        media_type="text/csv; charset=windows-1252",
        headers={
            "Content-Disposition": f'attachment; filename="{nom_propre}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
