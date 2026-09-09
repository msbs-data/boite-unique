"""Stockage et recherche avec PostgreSQL / SQLAlchemy.

Dépôt pour le cabinet comptable : gestion des dossiers, des pièces,
de l'extraction Factur-X, de la quarantaine et des exports Sage.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Optional
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..core import database as db_mod
from ..models.dossier import Dossier
from ..models.piece import Piece
from ..models.extraction import Extraction
from ..models.quarantaine import Quarantaine
from ..models.export import Export

logger = logging.getLogger("boite_unique.store")

CHAMPS_EXTRAITS = (
    "numero", "date_facture", "fournisseur", "tva_intracom", "siren",
    "montant_ht", "montant_tva", "montant_ttc", "devise", "profil",
)


class DepotPostgres:
    def __init__(self, session_factory=None) -> None:
        self._session_factory = session_factory

    @property
    def session_factory(self):
        return self._session_factory if self._session_factory is not None else db_mod.SessionLocal

    @staticmethod
    def empreinte(contenu: bytes) -> str:
        return hashlib.sha256(contenu).hexdigest()

    # ---------- dossiers ----------

    def ajouter_dossier(self, code: str, raison_sociale: str, alias: str) -> None:
        with self.session_factory() as session:
            existing = session.query(Dossier).filter_by(code=code).first()
            if not existing:
                d = Dossier(code=code, raison_sociale=raison_sociale, alias=alias.lower(), actif=True)
                session.add(d)
                session.commit()

    def alias_connus(self) -> dict[str, str]:
        with self.session_factory() as session:
            rows = session.query(Dossier.alias, Dossier.code).filter(Dossier.actif == True).all()
            return {r[0]: r[1] for r in rows}

    def dossiers(self) -> list[dict]:
        with self.session_factory() as session:
            rows = session.query(Dossier).order_by(Dossier.raison_sociale).all()
            return [
                {
                    "id": r.id,
                    "code": r.code,
                    "raison_sociale": r.raison_sociale,
                    "alias": r.alias,
                    "actif": r.actif,
                }
                for r in rows
            ]

    # ---------- pièces ----------

    def enregistrer_piece(self, piece: dict, texte: str = "") -> int | None:
        """Enregistre la pièce, ou rend None si la pièce est un doublon déjà connu."""
        with self.session_factory() as session:
            dossier_obj = session.query(Dossier).filter_by(code=piece["dossier"]).first()
            if not dossier_obj:
                return None

            deja = session.query(Piece).filter_by(
                dossier_id=dossier_obj.id,
                empreinte=piece["empreinte"]
            ).first()
            if deja:
                return None

            p = Piece(
                dossier_id=dossier_obj.id,
                nom_fichier=piece["nom_fichier"],
                empreinte=piece["empreinte"],
                recue_le=piece.get("recue_le") or datetime.now().isoformat(timespec="seconds"),
                source=piece.get("source", "mail"),
                type=piece["type"],
                etat=piece["etat"],
                expediteur=piece.get("expediteur"),
                alias_vise=piece.get("alias_vise"),
                entete_retenu=piece.get("entete_retenu"),
                chemin_image=piece.get("chemin_image", ""),
            )
            session.add(p)
            session.flush()

            if piece.get("extraction"):
                e = piece["extraction"]
                champs_val = e.get("champs", {})
                ext = Extraction(
                    piece_id=p.id,
                    champs=champs_val if isinstance(champs_val, dict) else {},
                    confiance=float(e.get("confiance", 0.0)),
                    methode=e.get("methode", ""),
                    validee_par=None,
                )
                session.add(ext)

            session.commit()
            return p.id

    def mettre_en_quarantaine(
        self, nom: str, expediteur: str | None, adresses: list[str], motif: str
    ) -> None:
        with self.session_factory() as session:
            q = Quarantaine(
                nom_fichier=nom,
                recue_le=datetime.now().isoformat(timespec="seconds"),
                expediteur=expediteur,
                adresses_examinees=", ".join(adresses) or "aucune",
                motif=motif,
            )
            session.add(q)
            session.commit()

    def quarantaine(self) -> list[dict]:
        with self.session_factory() as session:
            rows = session.query(Quarantaine).order_by(Quarantaine.id.desc()).all()
            return [
                {
                    "id": r.id,
                    "nom_fichier": r.nom_fichier,
                    "recue_le": r.recue_le,
                    "expediteur": r.expediteur,
                    "adresses_examinees": r.adresses_examinees,
                    "motif": r.motif,
                }
                for r in rows
            ]

    def vider_quarantaine(self) -> None:
        with self.session_factory() as session:
            session.query(Quarantaine).delete()
            session.commit()

    # ---------- recherche et consultation ----------

    def pieces(self, requete: str = "", etat: str = "", dossier: str = "") -> list[dict]:
        with self.session_factory() as session:
            query = session.query(Piece, Dossier, Extraction).join(
                Dossier, Dossier.id == Piece.dossier_id
            ).outerjoin(
                Extraction, Extraction.piece_id == Piece.id
            )

            if etat:
                query = query.filter(Piece.etat == etat)
            if dossier:
                query = query.filter(Dossier.code == dossier)
            if requete:
                tokens = requete.strip().split()
                for token in tokens:
                    term = f"%{token}%"
                    query = query.filter(
                        or_(
                            Piece.nom_fichier.ilike(term),
                            Dossier.raison_sociale.ilike(term),
                            Dossier.code.ilike(term),
                            Piece.expediteur.ilike(term),
                        )
                    )

            query = query.order_by(Piece.recue_le.desc(), Piece.id.desc())

            sorties = []
            for p, d, e in query.all():
                item = {
                    "id": p.id,
                    "dossier_id": p.dossier_id,
                    "dossier": d.code,
                    "dossier_code": d.code,
                    "raison_sociale": d.raison_sociale,
                    "nom_fichier": p.nom_fichier,
                    "empreinte": p.empreinte,
                    "recue_le": p.recue_le,
                    "source": p.source,
                    "type": p.type,
                    "etat": p.etat,
                    "expediteur": p.expediteur,
                    "alias_vise": p.alias_vise,
                    "entete_retenu": p.entete_retenu,
                    "chemin_image": p.chemin_image,
                    "confiance": e.confiance if e else None,
                    "methode": e.methode if e else None,
                    "validee_par": e.validee_par if e else None,
                }
                for cle in CHAMPS_EXTRAITS:
                    item[cle] = None
                if e and e.champs:
                    champs_data = e.champs if isinstance(e.champs, dict) else json.loads(e.champs)
                    for k, v in champs_data.items():
                        if k in CHAMPS_EXTRAITS:
                            item[k] = v
                sorties.append(item)
            return sorties

    def piece(self, piece_id: int) -> dict | None:
        res = self.pieces()
        trouvees = [p for p in res if p["id"] == piece_id]
        return trouvees[0] if trouvees else None

    def valider(self, piece_id: int, par: str) -> None:
        with self.session_factory() as session:
            session.query(Piece).filter(Piece.id == piece_id).update({"etat": "lue"})
            session.query(Extraction).filter(Extraction.piece_id == piece_id).update({"validee_par": par})
            session.commit()

    # ---------- exports ----------

    def marquer_exportees(self, ids: list[int], fichier: str) -> None:
        if not ids:
            return
        with self.session_factory() as session:
            session.query(Piece).filter(Piece.id.in_(ids)).update(
                {"etat": "exportee"}, synchronize_session=False
            )
            exp = Export(
                fait_le=datetime.now().isoformat(timespec="seconds"),
                fichier=fichier,
                nb_pieces=len(ids),
                pieces=ids,
            )
            session.add(exp)
            session.commit()

    def exports(self) -> list[dict]:
        with self.session_factory() as session:
            rows = session.query(Export).order_by(Export.id.desc()).all()
            return [
                {
                    "id": r.id,
                    "fait_le": r.fait_le,
                    "fichier": r.fichier,
                    "nb_pieces": r.nb_pieces,
                    "pieces": r.pieces if isinstance(r.pieces, list) else json.loads(r.pieces),
                }
                for r in rows
            ]

    def compteurs(self) -> dict:
        with self.session_factory() as session:
            total_pieces = session.query(func.count(Piece.id)).scalar() or 0
            lues = session.query(func.count(Piece.id)).filter(Piece.etat == "lue").scalar() or 0
            a_verifier = session.query(func.count(Piece.id)).filter(Piece.etat == "a_verifier").scalar() or 0
            exportees = session.query(func.count(Piece.id)).filter(Piece.etat == "exportee").scalar() or 0
            structurees = session.query(func.count(Piece.id)).filter(Piece.type == "structure").scalar() or 0
            quarantaine = session.query(func.count(Quarantaine.id)).scalar() or 0
            dossiers = session.query(func.count(Dossier.id)).filter(Dossier.actif == True).scalar() or 0
            return {
                "pieces": total_pieces,
                "lues": lues,
                "a_verifier": a_verifier,
                "exportees": exportees,
                "structurees": structurees,
                "quarantaine": quarantaine,
                "dossiers": dossiers,
            }

    def reinitialiser(self) -> None:
        with self.session_factory() as session:
            session.query(Extraction).delete()
            session.query(Piece).delete()
            session.query(Quarantaine).delete()
            session.query(Export).delete()
            session.query(Dossier).delete()
            session.commit()
