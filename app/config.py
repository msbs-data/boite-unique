from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DONNEES = RACINE / "data"
ENTRANT = DONNEES / "entrant"
IMAGES = DONNEES / "pieces"
BASE = DONNEES / "cabinet.db"
EXPORTS = DONNEES / "exports"

DOMAINE = "cabinet-demo.fr"
ATTRAPE_TOUT = {f"pieces@{DOMAINE}", f"comptabilite@{DOMAINE}", f"postmaster@{DOMAINE}"}
UTILISATEUR = "M. Loiseau"
