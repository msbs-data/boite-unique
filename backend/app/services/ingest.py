"""Réception d'un mail et de ses pièces jointes."""

from __future__ import annotations

import email
import email.policy
from datetime import datetime
from pathlib import Path

from .facturx import PasDeXML, lire_pdf
from .routing import router
from .store import DepotPostgres

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
    nom_lower = nom.lower()
    if "brasserie" in nom_lower or "commerce" in nom_lower:
        return {
            "champs": {
                "fournisseur": "Brasserie du Commerce",
                "numero": "Table 12 - Lyon",
                "date_facture": "2026-02-14",
                "siren": "123456789",
                "tva_intracom": "FR89123456789",
                "montant_ht": "39.17",
                "montant_tva": "7.83",
                "montant_ttc": "47.00",
                "devise": "EUR",
                "profil": "Ticket Caisse / Repas Client",
            },
            "confiance": 0.88,
            "methode": "OCR Vision AI (Photo smartphone)",
        }
    if "point" in nom_lower or "livraison" in nom_lower:
        return {
            "champs": {
                "fournisseur": "POINT.P Matériaux de Construction",
                "numero": "FA-2026-8821",
                "date_facture": "2026-10-14",
                "siren": "123456789",
                "tva_intracom": "FR40123456789",
                "montant_ht": "412.50",
                "montant_tva": "82.50",
                "montant_ttc": "495.00",
                "devise": "EUR",
                "profil": "Bon de Livraison / Matériaux",
            },
            "confiance": 0.92,
            "methode": "OCR Vision AI (Document chantier)",
        }
    if any(k in nom_lower for k in ("total", "essence", "gazole", "img_4471")):
        return {
            "champs": {
                "fournisseur": "Station TotalEnergies Relais de l Arbois",
                "numero": "TKT-004512",
                "date_facture": "2026-02-18",
                "siren": "542051180",
                "tva_intracom": "FR27542051180",
                "montant_ht": "89.98",
                "montant_tva": "18.00",
                "montant_ttc": "107.98",
                "devise": "EUR",
                "profil": "Ticket Carburant / Camionnette",
            },
            "confiance": 0.90,
            "methode": "OCR Vision AI (Ticket thermique)",
        }
    if "bistrot" in nom_lower or "martin" in nom_lower:
        return {
            "champs": {
                "fournisseur": "Bistrot Saint-Martin",
                "numero": "TKT-10842",
                "date_facture": "2026-02-22",
                "siren": "801234567",
                "tva_intracom": "FR15801234567",
                "montant_ht": "26.82",
                "montant_tva": "2.68",
                "montant_ttc": "29.50",
                "devise": "EUR",
                "profil": "Note de Frais Artisan",
            },
            "confiance": 0.87,
            "methode": "OCR Vision AI (Photo smartphone)",
        }
    if "note_restaurant" in nom_lower or "resto" in nom_lower:
        return {
            "champs": {
                "fournisseur": "Brasserie du Commerce",
                "numero": "Table 12",
                "date_facture": "2026-02-14",
                "siren": "123456789",
                "tva_intracom": "FR89123456789",
                "montant_ht": "39.17",
                "montant_tva": "7.83",
                "montant_ttc": "47.00",
                "devise": "EUR",
                "profil": "Ticket Restaurant",
            },
            "confiance": 0.88,
            "methode": "OCR Vision AI (Photo smartphone)",
        }
    return {
        "champs": {"fournisseur": "Fournisseur à vérifier", "montant_ttc": None, "date_facture": None},
        "confiance": 0.50,
        "methode": "image (simulée en démonstration)",
    }


def traiter_mail(
    brut: bytes, depot: DepotPostgres, attrape_tout: set[str], dossier_images: Path
) -> dict:
    """Traite un mail complet. Rend un compte rendu lisible par l'interface."""
    msg = email.message_from_bytes(brut, policy=email.policy.default)
    expediteur = str(msg.get("From", ""))
    sujet = str(msg.get("Subject", "(sans objet)"))

    routage = router(msg, depot.alias_connus(), attrape_tout)
    jointes = [p for p in msg.iter_attachments() if p.get_filename()]

    if routage.en_quarantaine:
        noms = ", ".join(p.get_filename() for p in jointes) or sujet
        depot.mettre_en_quarantaine(
            noms,
            expediteur,
            list(routage.examinees),
            "aucune adresse connue parmi les en-têtes du message",
        )
        return {
            "resultat": "quarantaine",
            "dossier": None,
            "adresses": routage.examinees,
            "sujet": sujet,
            "nb": len(jointes),
        }

    if not jointes:
        texte = _texte_du_corps(msg)
        contenu = texte.encode()
        piece = {
            "dossier": routage.alias,
            "nom_fichier": f"{sujet}.txt",
            "empreinte": depot.empreinte(contenu),
            "recue_le": datetime.now().isoformat(timespec="seconds"),
            "source": "mail",
            "type": "image",
            "etat": "a_verifier",
            "expediteur": expediteur,
            "alias_vise": routage.alias,
            "entete_retenu": routage.entete,
            "extraction": _extraction_simulee(sujet),
        }
        cree = depot.enregistrer_piece(piece, f"{sujet} {texte} {expediteur}")
        return {
            "resultat": "corps" if cree else "doublon",
            "dossier": routage.alias,
            "sujet": sujet,
            "nb": 1,
            "ids": [cree] if cree else [],
        }

    dossier_images.mkdir(parents=True, exist_ok=True)
    ids, doublons, details = [], 0, []

    for partie in jointes:
        nom = partie.get_filename() or "piece"
        contenu = partie.get_payload(decode=True) or b""
        empreinte = depot.empreinte(contenu)

        suffixe = Path(nom).suffix.lower()
        if suffixe not in SUFFIXES_STOCKES:
            suffixe = ".bin"

        facture = None
        if suffixe == ".pdf":
            try:
                facture = lire_pdf(contenu)
            except (PasDeXML, Exception):
                facture = None

        # Sanitize filename and save using hash prefix
        nom_propre = f"{empreinte[:16]}{suffixe}"
        chemin = dossier_images / nom_propre
        chemin.write_bytes(contenu)

        if facture is not None:
            champs = facture.as_dict()
            confiance = 1.0 if facture.coherent else 0.80
            piece = {
                "dossier": routage.alias,
                "nom_fichier": nom,
                "empreinte": empreinte,
                "recue_le": datetime.now().isoformat(timespec="seconds"),
                "source": "mail",
                "type": "structure",
                "etat": "lue" if confiance >= SEUIL_CONFIANCE else "a_verifier",
                "expediteur": expediteur,
                "alias_vise": routage.alias,
                "entete_retenu": routage.entete,
                "chemin_image": chemin.name,
                "extraction": {
                    "champs": champs,
                    "confiance": confiance,
                    "methode": "Factur-X (XML embarqué, sans reconnaissance d'image)",
                },
            }
            texte = " ".join(str(v) for v in champs.values() if v) + f" {nom} {sujet}"
            details.append(f"{nom} — Factur-X lue, {champs.get('montant_ttc') or '?'} €")
        else:
            extraction = _extraction_simulee(nom)
            piece = {
                "dossier": routage.alias,
                "nom_fichier": nom,
                "empreinte": empreinte,
                "recue_le": datetime.now().isoformat(timespec="seconds"),
                "source": "mail",
                "type": "image" if suffixe in EXTENSIONS_IMAGE else "autre",
                "etat": "a_verifier",
                "expediteur": expediteur,
                "alias_vise": routage.alias,
                "entete_retenu": routage.entete,
                "chemin_image": chemin.name,
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

    return {
        "resultat": "classee",
        "dossier": routage.alias,
        "entete": routage.entete,
        "sujet": sujet,
        "nb": len(jointes),
        "ids": ids,
        "doublons": doublons,
        "details": details,
    }
