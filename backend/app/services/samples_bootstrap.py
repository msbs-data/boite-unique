"""Amorçage : les dossiers clients, leur temps pointé et le relevé bancaire."""

from __future__ import annotations

from ..core.config import settings
from .store import DepotPostgres

DOSSIERS = [
    ("VELLARD-TOI", "SARL Vellard Toitures", "vellard"),
    ("FERRAND-BOU", "Boulangerie Ferrand", "ferrand"),
    ("NEDJAR-GAR", "Garage Nedjar", "nedjar"),
    ("LOISEAU-CON", "Cabinet Loiseau Conseil", "loiseau"),
    ("BAKKALI-TRA", "Transports Bakkali", "bakkali"),
    ("KESSLER-FLE", "Fleuriste Kessler", "kessler"),
    ("OTTAVI-MEN", "Menuiserie Ottavi", "ottavi"),
]


def amorcer(depot: DepotPostgres) -> None:
    for code, raison, alias in DOSSIERS:
        depot.ajouter_dossier(code, raison, f"{alias}@{settings.DOMAINE}")


# --------------------------------------------------------------- facturation

# Temps pointé du mois : nombre de demi-journées réparties sur les semaines.
# Chiffres plausibles pour un cabinet de 60 dossiers dont douze bougent.
TEMPS = {
    "VELLARD-TOI": [(2, 1.5, "Révision pièces septembre"), (5, 2.0, "Rapprochement bancaire"),
                    (9, 1.0, "Point client"), (16, 2.5, "TVA")],
    "FERRAND-BOU": [(3, 1.0, "Saisie"), (10, 1.5, "TVA"), (17, 2.0, "Révision")],
    "NEDJAR-GAR":  [(1, 2.0, "Saisie"), (8, 1.5, "Immobilisations"), (15, 1.5, "TVA")],
    "LOISEAU-CON": [(4, 1.0, "Conseil"), (11, 0.5, "Point client")],
    "BAKKALI-TRA": [(2, 3.0, "Volume septembre"), (9, 2.0, "Péages et carburant"),
                    (16, 2.5, "TVA"), (23, 2.0, "Révision")],
    "KESSLER-FLE": [(5, 1.0, "Saisie")],
    "OTTAVI-MEN":  [(3, 1.5, "Saisie"), (12, 1.0, "TVA")],
}


def amorcer_facturation(periode: str | None = None) -> dict:
    """Pose le temps du mois et un relevé bancaire cohérent avec les factures.

    Le relevé contient volontairement trois cas : un virement qui cite le numéro
    de facture, un virement qui ne le cite pas mais dont le montant tombe juste,
    et un règlement partiel — pour que le rapprochement montre ses trois issues.
    """
    from datetime import date
    from .facturation import Depot, TAUX_TVA, taux_par_defaut

    depot = Depot()
    periode = periode or date.today().strftime("%Y-%m")
    if depot.temps(periode):
        return {"message": "Le temps du mois est déjà pointé.", "lignes": 0}

    poses = 0
    for code, entrees in TEMPS.items():
        for jour, heures, libelle in entrees:
            try:
                depot.saisir_temps(code, f"{periode}-{jour:02d}", heures,
                                   taux_par_defaut(code), libelle, "M. Loiseau")
                poses += 1
            except ValueError:
                pass

    # Un relevé bancaire du mois précédent, sur des factures déjà émises ailleurs.
    releve = [
        {"jour": f"{periode}-04", "libelle": "VIR SEPA SARL VELLARD TOITURES FH-202608-001",
         "montant": 512.05, "reference": "FH-202608-001"},
        {"jour": f"{periode}-05", "libelle": "VIR SEPA BOULANGERIE FERRAND", "montant": 228.00,
         "reference": None},
        {"jour": f"{periode}-08", "libelle": "VIR SEPA TRANSPORTS BAKKALI ACOMPTE",
         "montant": 400.00, "reference": None},
        {"jour": f"{periode}-11", "libelle": "PRLV LOYER LOCAL CABINET", "montant": -1150.00,
         "reference": None},
        {"jour": f"{periode}-12", "libelle": "VIR SEPA CABINET LOISEAU CONSEIL", "montant": 198.00,
         "reference": None},
    ]
    lignes_relve = depot.importer_releve(releve)
    return {"message": f"{poses} ligne(s) de temps et {lignes_relve} ligne(s) de relevé.",
            "lignes": poses}
