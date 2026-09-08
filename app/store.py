"""Stockage et recherche.

En démonstration : SQLite et son index plein texte FTS5, pour que tout tourne
sur un portable sans rien installer.

En production : Paperless-ngx tient l'ingestion, la reconnaissance de caractères,
le stockage et l'index — on ne réécrit pas ce qu'il fait déjà. Les deux
implémentations partagent la même interface, `Depot`, pour que le passage de
l'une à l'autre ne touche ni au routage, ni à la lecture Factur-X, ni à l'export.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

CHAMPS_EXTRAITS = (
    "numero", "date_facture", "fournisseur", "tva_intracom", "siren",
    "montant_ht", "montant_tva", "montant_ttc", "devise", "profil",
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS dossier (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  raison_sociale TEXT NOT NULL,
  alias TEXT UNIQUE NOT NULL,
  actif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS piece (
  id INTEGER PRIMARY KEY,
  dossier_id INTEGER REFERENCES dossier(id),
  nom_fichier TEXT NOT NULL,
  empreinte TEXT NOT NULL,
  recue_le TEXT NOT NULL,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  etat TEXT NOT NULL,
  expediteur TEXT,
  alias_vise TEXT,
  entete_retenu TEXT,
  chemin_image TEXT,
  UNIQUE (dossier_id, empreinte)
);

CREATE TABLE IF NOT EXISTS extraction (
  piece_id INTEGER PRIMARY KEY REFERENCES piece(id),
  champs TEXT NOT NULL,
  confiance REAL NOT NULL,
  methode TEXT NOT NULL,
  validee_par TEXT
);

CREATE TABLE IF NOT EXISTS quarantaine (
  id INTEGER PRIMARY KEY,
  nom_fichier TEXT NOT NULL,
  recue_le TEXT NOT NULL,
  expediteur TEXT,
  adresses_examinees TEXT NOT NULL,
  motif TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export (
  id INTEGER PRIMARY KEY,
  fait_le TEXT NOT NULL,
  fichier TEXT NOT NULL,
  nb_pieces INTEGER NOT NULL,
  pieces TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS piece_texte
  USING fts5(contenu, content='');
"""


class Depot(Protocol):
    """Interface partagée par le dépôt de démonstration et celui de production."""

    def enregistrer_piece(self, piece: dict, texte: str) -> int | None: ...
    def pieces(self, requete: str = "", etat: str = "", dossier: str = "") -> list[dict]: ...
    def marquer_exportees(self, ids: list[int], fichier: str) -> None: ...


class DepotSQLite:
    def __init__(self, chemin: Path) -> None:
        chemin.parent.mkdir(parents=True, exist_ok=True)
        self.cx = sqlite3.connect(chemin, check_same_thread=False)
        self.cx.row_factory = sqlite3.Row
        self.cx.executescript(SCHEMA)
        self.cx.commit()

    # ---------- dossiers ----------

    def ajouter_dossier(self, code: str, raison_sociale: str, alias: str) -> None:
        self.cx.execute(
            "INSERT OR IGNORE INTO dossier (code, raison_sociale, alias) VALUES (?,?,?)",
            (code, raison_sociale, alias.lower()),
        )
        self.cx.commit()

    def alias_connus(self) -> dict[str, str]:
        rows = self.cx.execute("SELECT alias, code FROM dossier WHERE actif = 1").fetchall()
        return {r["alias"]: r["code"] for r in rows}

    def dossiers(self) -> list[dict]:
        return [dict(r) for r in self.cx.execute(
            "SELECT * FROM dossier ORDER BY raison_sociale").fetchall()]

    # ---------- pièces ----------

    @staticmethod
    def empreinte(contenu: bytes) -> str:
        return hashlib.sha256(contenu).hexdigest()

    def enregistrer_piece(self, piece: dict, texte: str = "") -> int | None:
        """Rend l'identifiant, ou None si la pièce est un doublon déjà connu."""
        row = self.cx.execute("SELECT id FROM dossier WHERE code = ?",
                              (piece["dossier"],)).fetchone()
        if row is None:
            return None
        deja = self.cx.execute(
            "SELECT id FROM piece WHERE dossier_id = ? AND empreinte = ?",
            (row["id"], piece["empreinte"]),
        ).fetchone()
        if deja:
            return None

        cur = self.cx.execute(
            """INSERT INTO piece (dossier_id, nom_fichier, empreinte, recue_le, source,
                                  type, etat, expediteur, alias_vise, entete_retenu, chemin_image)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (row["id"], piece["nom_fichier"], piece["empreinte"],
             piece.get("recue_le") or datetime.now().isoformat(timespec="seconds"),
             piece.get("source", "mail"), piece["type"], piece["etat"],
             piece.get("expediteur"), piece.get("alias_vise"),
             piece.get("entete_retenu"), piece.get("chemin_image", "")),
        )
        piece_id = cur.lastrowid
        # Le nom du dossier et son adresse sont toujours indexés : le comptable
        # cherche « ferrand » avant de chercher « grands moulins ».
        dossier = self.cx.execute(
            "SELECT raison_sociale, alias, code FROM dossier WHERE id = ?", (row["id"],)
        ).fetchone()
        indexe = " ".join(filter(None, [
            dossier["raison_sociale"], dossier["alias"], dossier["code"],
            piece["nom_fichier"], texte,
        ]))
        self.cx.execute("INSERT INTO piece_texte (rowid, contenu) VALUES (?,?)",
                        (piece_id, indexe))
        if piece.get("extraction"):
            e = piece["extraction"]
            self.cx.execute(
                """INSERT INTO extraction (piece_id, champs, confiance, methode, validee_par)
                   VALUES (?,?,?,?,?)""",
                (piece_id, json.dumps(e["champs"], ensure_ascii=False),
                 e["confiance"], e["methode"], None),
            )
        self.cx.commit()
        return piece_id

    def mettre_en_quarantaine(self, nom: str, expediteur: str | None,
                              adresses: list[str], motif: str) -> None:
        self.cx.execute(
            """INSERT INTO quarantaine (nom_fichier, recue_le, expediteur,
                                        adresses_examinees, motif)
               VALUES (?,?,?,?,?)""",
            (nom, datetime.now().isoformat(timespec="seconds"), expediteur,
             ", ".join(adresses) or "aucune", motif),
        )
        self.cx.commit()

    def quarantaine(self) -> list[dict]:
        return [dict(r) for r in self.cx.execute(
            "SELECT * FROM quarantaine ORDER BY id DESC").fetchall()]

    def vider_quarantaine(self) -> None:
        self.cx.execute("DELETE FROM quarantaine")
        self.cx.commit()

    # ---------- recherche ----------

    def pieces(self, requete: str = "", etat: str = "", dossier: str = "") -> list[dict]:
        params: list[Any] = []
        sql = """
        SELECT p.*, d.raison_sociale, d.code AS dossier_code,
               e.champs, e.confiance, e.methode, e.validee_par
        FROM piece p
        JOIN dossier d ON d.id = p.dossier_id
        LEFT JOIN extraction e ON e.piece_id = p.id
        """
        conditions: list[str] = []
        requete = (requete or "").strip()
        if requete:
            sql += " JOIN piece_texte t ON t.rowid = p.id "
            conditions.append("piece_texte MATCH ?")
            params.append(" ".join(f'"{mot}"*' for mot in requete.split()))
        if etat:
            conditions.append("p.etat = ?")
            params.append(etat)
        if dossier:
            conditions.append("d.code = ?")
            params.append(dossier)
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY p.recue_le DESC, p.id DESC"

        sorties = []
        for r in self.cx.execute(sql, params).fetchall():
            piece = dict(r)
            champs = json.loads(piece.pop("champs") or "{}")
            # Toutes les pièces ont la même forme : un champ non extrait vaut None,
            # il n'est jamais absent. L'interface n'a ainsi jamais de cas particulier.
            piece.update({cle: None for cle in CHAMPS_EXTRAITS})
            piece.update({k: v for k, v in champs.items() if k in CHAMPS_EXTRAITS})
            sorties.append(piece)
        return sorties

    def piece(self, piece_id: int) -> dict | None:
        trouvees = [p for p in self.pieces() if p["id"] == piece_id]
        return trouvees[0] if trouvees else None

    def valider(self, piece_id: int, par: str) -> None:
        self.cx.execute("UPDATE piece SET etat = 'lue' WHERE id = ?", (piece_id,))
        self.cx.execute("UPDATE extraction SET validee_par = ? WHERE piece_id = ?",
                        (par, piece_id))
        self.cx.commit()

    # ---------- exports ----------

    def marquer_exportees(self, ids: list[int], fichier: str) -> None:
        if not ids:
            return
        marques = ",".join("?" * len(ids))
        self.cx.execute(f"UPDATE piece SET etat = 'exportee' WHERE id IN ({marques})", ids)
        self.cx.execute(
            "INSERT INTO export (fait_le, fichier, nb_pieces, pieces) VALUES (?,?,?,?)",
            (datetime.now().isoformat(timespec="seconds"), fichier, len(ids),
             json.dumps(ids)),
        )
        self.cx.commit()

    def exports(self) -> list[dict]:
        return [dict(r) for r in self.cx.execute(
            "SELECT * FROM export ORDER BY id DESC").fetchall()]

    def compteurs(self) -> dict:
        """Le compteur de la section 10 : ce qui rendra les parties 2 et 3 mesurables."""
        q = lambda s, *p: self.cx.execute(s, p).fetchone()[0]
        return {
            "pieces": q("SELECT COUNT(*) FROM piece"),
            "lues": q("SELECT COUNT(*) FROM piece WHERE etat = 'lue'"),
            "a_verifier": q("SELECT COUNT(*) FROM piece WHERE etat = 'a_verifier'"),
            "exportees": q("SELECT COUNT(*) FROM piece WHERE etat = 'exportee'"),
            "structurees": q("SELECT COUNT(*) FROM piece WHERE type = 'structure'"),
            "quarantaine": q("SELECT COUNT(*) FROM quarantaine"),
            "dossiers": q("SELECT COUNT(*) FROM dossier WHERE actif = 1"),
        }
