"""Réception d'un mail et de ses pièces jointes.

Code de production pour tout ce qui concerne le mail lui-même : découpage des
pièces jointes, empreinte, dédoublonnage, routage, quarantaine.

La lecture des images est SIMULÉE dans cette démonstration. En production,
Paperless-ngx fournit le texte reconnu et un modèle local tourne dessus avec
une sortie contrainte par schéma. Ici, un extracteur factice rend un résultat
peu sûr, pour montrer le comportement attendu : toute pièce dont la confiance
est insuffisante part en file « à vérifier » et ne peut pas être exportée.
"""

from __future__ import annotations

import email
import email.policy
from datetime import datetime
from pathlib import Path

from .facturx import PasDeXML, lire_pdf
from .routing import router
from .store import DepotSQLite

SEUIL_CONFIANCE = 0.85
EXTENSIONS_IMAGE = {".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff"}
SUFFIXES_STOCKES = EXTENSIONS_IMAGE | {".pdf", ".txt", ".xml", ".csv"}


def _texte_du_corps(msg) -> str:
    corps = msg.get_body(preferencelist=("plain", "html"))
    if corps is None:
        return ""
    try:
        return corps.get_content()[:4000]
    except Exception:
        return ""


def _extraction_simulee(nom: str) -> dict:
    """Tient lieu de « OCR + modèle local ». Rend volontairement peu de certitude.

    En production : texte reconnu par Paperless, puis modèle local sous contrainte
    de schéma (Outlines), puis contrôles — cohérence HT+TVA=TTC, clé du SIREN,
    date plausible, écart au montant habituel du fournisseur.
    """
    return {
        "champs": {"fournisseur": None, "montant_ttc": None, "date_facture": None},
        "confiance": 0.42,
        "methode": "image (simulée en démonstration)",
    }


def traiter_mail(brut: bytes, depot: DepotSQLite, attrape_tout: set[str],
                 dossier_images: Path) -> dict:
    """Traite un mail complet. Rend un compte rendu lisible par l'interface."""
    msg = email.message_from_bytes(brut, policy=email.policy.default)
    expediteur = str(msg.get("From", ""))
    sujet = str(msg.get("Subject", "(sans objet)"))

    routage = router(msg, depot.alias_connus(), attrape_tout)
    jointes = [p for p in msg.iter_attachments() if p.get_filename()]

    if routage.en_quarantaine:
        noms = ", ".join(p.get_filename() for p in jointes) or sujet
        depot.mettre_en_quarantaine(
            noms, expediteur, list(routage.examinees),
            "aucune adresse connue parmi les en-têtes du message",
        )
        return {"resultat": "quarantaine", "dossier": None, "adresses": routage.examinees,
                "sujet": sujet, "nb": len(jointes)}

    if not jointes:
        # Le corps du mail vaut pièce : on le conserve plutôt que de le perdre.
        texte = _texte_du_corps(msg)
        contenu = texte.encode()
        piece = {
            "dossier": routage.alias, "nom_fichier": f"{sujet}.txt",
            "empreinte": depot.empreinte(contenu),
            "recue_le": datetime.now().isoformat(timespec="seconds"),
            "source": "mail", "type": "image", "etat": "a_verifier",
            "expediteur": expediteur, "alias_vise": routage.alias,
            "entete_retenu": routage.entete,
            "extraction": _extraction_simulee(sujet),
        }
        cree = depot.enregistrer_piece(piece, f"{sujet} {texte} {expediteur}")
        return {"resultat": "corps" if cree else "doublon", "dossier": routage.alias,
                "sujet": sujet, "nb": 1, "ids": [cree] if cree else []}

    dossier_images.mkdir(parents=True, exist_ok=True)
    ids, doublons, details = [], 0, []

    for partie in jointes:
        nom = partie.get_filename()
        contenu = partie.get_payload(decode=True) or b""
        empreinte = depot.empreinte(contenu)
        # Le nom du fichier stocké est dérivé de l'empreinte, jamais du nom
        # fourni par l'expéditeur : celui-ci n'est conservé que pour l'affichage.
        suffixe = Path(nom).suffix.lower()
        if suffixe not in SUFFIXES_STOCKES:
            suffixe = ".bin"

        facture = None
        if suffixe == ".pdf":
            try:
                facture = lire_pdf(contenu)
            except (PasDeXML, Exception):
                facture = None

        chemin = dossier_images / f"{empreinte[:16]}{suffixe}"
        chemin.write_bytes(contenu)

        if facture is not None:
            champs = facture.as_dict()
            confiance = 1.0 if facture.coherent else 0.80
            piece = {
                "dossier": routage.alias, "nom_fichier": nom, "empreinte": empreinte,
                "recue_le": datetime.now().isoformat(timespec="seconds"),
                "source": "mail", "type": "structure",
                "etat": "lue" if confiance >= SEUIL_CONFIANCE else "a_verifier",
                "expediteur": expediteur, "alias_vise": routage.alias,
                "entete_retenu": routage.entete, "chemin_image": chemin.name,
                "extraction": {"champs": champs, "confiance": confiance,
                               "methode": "Factur-X (XML embarqué, sans reconnaissance d'image)"},
            }
            texte = " ".join(str(v) for v in champs.values() if v) + f" {nom} {sujet}"
            details.append(f"{nom} — Factur-X lue, {champs.get('montant_ttc') or '?'} €")
        else:
            extraction = _extraction_simulee(nom)
            piece = {
                "dossier": routage.alias, "nom_fichier": nom, "empreinte": empreinte,
                "recue_le": datetime.now().isoformat(timespec="seconds"),
                "source": "mail",
                "type": "image" if suffixe in EXTENSIONS_IMAGE else "autre",
                "etat": "a_verifier",
                "expediteur": expediteur, "alias_vise": routage.alias,
                "entete_retenu": routage.entete, "chemin_image": chemin.name,
                "extraction": extraction,
            }
            texte = f"{nom} {sujet} {expediteur}"
            details.append(f"{nom} — à vérifier")

        cree = depot.enregistrer_piece(piece, texte)
        if cree:
            ids.append(cree)
        else:
            doublons += 1
            details[-1] = f"{nom} — doublon, déjà reçue"

    return {"resultat": "classee", "dossier": routage.alias, "entete": routage.entete,
            "sujet": sujet, "nb": len(jointes), "ids": ids,
            "doublons": doublons, "details": details}


def relever_dossier(chemin: Path, depot: DepotSQLite, attrape_tout: set[str],
                    dossier_images: Path) -> list[dict]:
    """Relève un dossier de fichiers .eml. En production, c'est la boîte IMAP."""
    comptes = []
    for fichier in sorted(chemin.glob("*.eml")):
        comptes.append(traiter_mail(fichier.read_bytes(), depot, attrape_tout, dossier_images))
    return comptes
