"""Amorçage : les dossiers clients du cabinet, et leurs adresses."""

from .config import DOMAINE
from .store import DepotSQLite

DOSSIERS = [
    ("VELLARD-TOI", "SARL Vellard Toitures", "vellard"),
    ("FERRAND-BOU", "Boulangerie Ferrand", "ferrand"),
    ("NEDJAR-GAR", "Garage Nedjar", "nedjar"),
    ("LOISEAU-CON", "Cabinet Loiseau Conseil", "loiseau"),
    ("BAKKALI-TRA", "Transports Bakkali", "bakkali"),
    ("KESSLER-FLE", "Fleuriste Kessler", "kessler"),
    ("OTTAVI-MEN", "Menuiserie Ottavi", "ottavi"),
]


def amorcer(depot: DepotSQLite) -> None:
    for code, raison, alias in DOSSIERS:
        depot.ajouter_dossier(code, raison, f"{alias}@{DOMAINE}")
