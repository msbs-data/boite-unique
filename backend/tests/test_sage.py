"""L'export vers Sage — tests unitaires."""

from decimal import Decimal
from app.services.sage import ProfilSage, construire, rendre_csv

PIECE = {
    "id": 1,
    "nom_fichier": "FA-2026-4471.pdf",
    "etat": "lue",
    "numero": "FA-2026-4471",
    "fournisseur": "Point P Materiaux",
    "date_facture": "2026-09-04",
    "montant_ht": "1070.50",
    "montant_tva": "214.10",
    "montant_ttc": "1284.60",
    "chemin_image": "a1b2c3.pdf",
}


def test_ecriture_equilibree():
    export = construire([PIECE])
    assert len(export.lignes) == 3
    assert export.equilibre
    assert export.total_debit == Decimal("1284.60")


def test_piece_deja_exportee_ne_repart_jamais():
    exportee = dict(PIECE, etat="exportee")
    assert construire([exportee]).lignes == []
    assert construire([exportee]).pieces == []


def test_image_reportee_sur_chaque_ligne():
    for ligne in construire([PIECE]).lignes:
        assert ligne.image == "a1b2c3.pdf"


def test_sans_tva_deux_lignes_seulement():
    sans = dict(PIECE, montant_ht=None, montant_tva=None)
    lignes = construire([sans]).lignes
    assert len(lignes) == 2 and lignes[0].debit == Decimal("1284.60")


def test_piece_sans_montant_est_ignoree():
    assert construire([dict(PIECE, montant_ttc=None)]).lignes == []


def test_csv_encodage_et_separateur():
    csv = rendre_csv(construire([PIECE]))
    assert csv.startswith(b"Journal;Date;Compte")
    assert b"1284,60" in csv
    assert b"04/09/2026" in csv
    assert b"\r\n" in csv
    csv.decode("cp1252")


def test_le_profil_est_isolable():
    autre = ProfilSage(nom="autre", journal_achats="HA", compte_attente="401000")
    lignes = construire([PIECE], autre).lignes
    assert all(l.journal == "HA" for l in lignes)
    assert lignes[0].compte == "401000"
