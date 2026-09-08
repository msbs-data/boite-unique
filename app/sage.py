"""Export des écritures vers Sage Génération Experts.

Code de production, format PROVISOIRE.

Ce qui est établi : Sage Génération Experts importe un fichier tabulaire —
CSV ou Excel, séparateur point-virgule ou tabulation — et l'import « + images »
associe à chaque écriture un lien vers son image. Le collage se fait par
Utilitaires > Coller les lignes du presse-papier.

Ce qui ne l'est pas : l'ordre exact des colonnes et leurs intitulés, qui
dépendent de l'installation. Le profil ci-dessous doit être relevé sur une
installation réelle avant la mise en service. Il est isolé dans une classe
pour que ce relevé ne touche à rien d'autre.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

SEPARATEUR = ";"
ENCODAGE = "cp1252"  # Sage attend du Windows-1252, pas de l'UTF-8.


@dataclass(frozen=True)
class ProfilSage:
    """Disposition des colonnes. À valider sur une installation réelle."""

    nom: str = "Génération Experts + images (provisoire)"
    colonnes: tuple[str, ...] = (
        "Journal", "Date", "Compte", "Piece", "Libelle",
        "Debit", "Credit", "Devise", "Image",
    )
    format_date: str = "%d/%m/%Y"
    journal_achats: str = "AC"
    compte_attente: str = "471000"
    compte_tva: str = "445660"

    def montant(self, valeur: Decimal | None) -> str:
        return f"{valeur:.2f}".replace(".", ",") if valeur is not None else ""


@dataclass
class Ecriture:
    journal: str
    date_piece: date
    compte: str
    piece: str
    libelle: str
    debit: Decimal | None = None
    credit: Decimal | None = None
    devise: str = "EUR"
    image: str = ""


@dataclass
class Export:
    fichier: str
    lignes: list[Ecriture] = field(default_factory=list)
    pieces: list[int] = field(default_factory=list)

    @property
    def total_debit(self) -> Decimal:
        return sum((l.debit or Decimal(0) for l in self.lignes), Decimal(0))

    @property
    def equilibre(self) -> bool:
        credit = sum((l.credit or Decimal(0) for l in self.lignes), Decimal(0))
        return self.total_debit == credit


def ecritures_pour(piece: dict, profil: ProfilSage) -> list[Ecriture]:
    """Traduit une pièce lue en écritures. L'outil prépare, il n'impute pas.

    Le compte fournisseur n'est pas deviné : la contrepartie va en compte
    d'attente, à charge du comptable de l'imputer. C'est une décision de la
    spec — l'outil ne décide pas des imputations.
    """
    ht = Decimal(piece["montant_ht"]) if piece.get("montant_ht") else None
    tva = Decimal(piece["montant_tva"]) if piece.get("montant_tva") else None
    ttc = Decimal(piece["montant_ttc"]) if piece.get("montant_ttc") else None
    if ttc is None:
        return []
    if ht is None:
        ht, tva = ttc, Decimal("0.00")

    jour = date.fromisoformat(piece["date_facture"]) if piece.get("date_facture") else date.today()
    reference = piece.get("numero") or f"P{piece['id']:06d}"
    libelle = (piece.get("fournisseur") or piece["nom_fichier"])[:40]
    image = piece.get("chemin_image", "")

    lignes = [Ecriture(profil.journal_achats, jour, profil.compte_attente,
                       reference, libelle, debit=ht, image=image)]
    if tva and tva > 0:
        lignes.append(Ecriture(profil.journal_achats, jour, profil.compte_tva,
                               reference, f"TVA {libelle}"[:40], debit=tva, image=image))
    lignes.append(Ecriture(profil.journal_achats, jour, profil.compte_attente,
                           reference, libelle, credit=ttc, image=image))
    return lignes


def construire(pieces: list[dict], profil: ProfilSage | None = None) -> Export:
    """Assemble l'export. Les pièces déjà exportées ne sont jamais reprises."""
    profil = profil or ProfilSage()
    export = Export(fichier=f"ecritures_{date.today():%Y%m%d}.csv")
    for piece in pieces:
        if piece.get("etat") == "exportee":
            continue
        lignes = ecritures_pour(piece, profil)
        if lignes:
            export.lignes.extend(lignes)
            export.pieces.append(piece["id"])
    return export


def rendre_csv(export: Export, profil: ProfilSage | None = None) -> bytes:
    profil = profil or ProfilSage()
    tampon = io.StringIO()
    graveur = csv.writer(tampon, delimiter=SEPARATEUR, lineterminator="\r\n")
    graveur.writerow(profil.colonnes)
    for l in export.lignes:
        graveur.writerow([
            l.journal, l.date_piece.strftime(profil.format_date), l.compte, l.piece,
            l.libelle, profil.montant(l.debit), profil.montant(l.credit), l.devise, l.image,
        ])
    return tampon.getvalue().encode(ENCODAGE, errors="replace")
