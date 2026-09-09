"""L'agent de collecte des variables de paie.

Le gestionnaire ne relance plus personne : les clients écrivent où ils ont
l'habitude d'écrire — messagerie instantanée, courriel, Telegram — et l'agent
lit ce qui arrive.

Trois règles, les mêmes que partout ailleurs dans l'outil :

  1. L'agent propose, il ne valide jamais. Rien ne part vers le logiciel de
     paie sans qu'un humain l'ait vu.
  2. Chaque variable proposée cite le bout de phrase qui l'a produite. Une
     valeur sans extrait est une valeur inventée.
  3. Les valeurs aberrantes sont signalées au moment de la lecture, pas
     découvertes au moment du bulletin.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime

from ..core import database as db_mod
from ..models.dossier import Dossier
from ..models.paie import MessagePaie, VariablePaie

CANAUX = {"whatsapp": "WhatsApp", "gmail": "Courriel", "telegram": "Telegram"}
SEUIL = 0.85

# Ce que l'agent sait reconnaître. Le code est celui attendu par le logiciel
# de paie ; les plafonds servent à signaler, jamais à corriger.
REGLES = [
    {"code": "HS025", "libelle": "Heures supplémentaires", "unite": "heures", "plafond": 40,
     "motifs": [r"(\d+[.,]?\d*)\s*h(?:eures?)?\s*(?:supp|sup\b|suppl)", r"(?:supp|suppl)\w*\s*[:=]?\s*(\d+[.,]?\d*)"]},
    {"code": "ABS100", "libelle": "Jours d'absence", "unite": "jours", "plafond": 20,
     "motifs": [r"(\d+[.,]?\d*)\s*(?:jours?|j)\b[\s'’]*(?:d[\s'’]*)?(?:absence|arret|maladie|conge)",
                r"(?:absent|arret|malade|conge)\w*\s*(?:de\s*)?(\d+[.,]?\d*)\s*(?:jours?|j)\b"]},
    {"code": "PAN010", "libelle": "Paniers repas", "unite": "unités", "plafond": 23,
     "motifs": [r"(\d+[.,]?\d*)\s*paniers?", r"paniers?\s*[:=]?\s*(\d+[.,]?\d*)"]},
    {"code": "PRI200", "libelle": "Prime exceptionnelle", "unite": "euros", "plafond": 3000,
     "motifs": [r"prime\w*\s*(?:de\s*)?(\d+[.,]?\d*)\s*(?:€|euros?)?", r"(\d+[.,]?\d*)\s*(?:€|euros?)\s*de\s*prime"]},
]


def _sans_accent(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn").lower()


# Mots qui commencent par une majuscule sans désigner personne.
_PAS_UN_NOM = {
    "bonjour", "bonsoir", "salut", "merci", "cordialement", "voici", "pour", "variables",
    "variable", "jour", "jours", "mois", "heures", "heure", "paniers", "panier", "prime",
    "primes", "absence", "arret", "maladie", "conge", "conges", "supplementaires", "septembre",
    "octobre", "novembre", "decembre", "janvier", "fevrier", "mars", "avril", "juin", "juillet",
    "aout", "mai", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
    "rien", "tout", "bien", "sans", "avec", "salarie", "salaries", "semaine", "objet", "madame",
    "monsieur", "bonne", "journee",
}


def _salaries(texte: str) -> list[str]:
    """Le salarié concerné. « pour X » l'emporte : c'est ainsi qu'on écrit."""
    apres_pour = re.findall(r"\bpour\s+([A-ZÉÈÀÂÎÔÛ][\wéèêàâîôûç-]{2,})", texte)
    candidats = apres_pour or re.findall(r"\b([A-ZÉÈÀÂÎÔÛ][a-zéèêàâîôûç-]{2,})\b", texte)
    noms = [n for n in dict.fromkeys(candidats) if _sans_accent(n) not in _PAS_UN_NOM]
    return noms or ["Salarié non nommé"]


class AgentPaie:
    """Lit un message et en tire des variables. Ne décide rien."""

    def lire(self, texte: str) -> list[dict]:
        plat = _sans_accent(texte)
        noms = _salaries(texte)
        salarie = noms[0]
        trouvees: list[dict] = []
        for regle in REGLES:
            for motif in regle["motifs"]:
                m = re.search(motif, plat)
                if not m:
                    continue
                try:
                    valeur = float(m.group(1).replace(",", "."))
                except (ValueError, IndexError):
                    continue
                debut, fin = max(0, m.start() - 18), min(len(texte), m.end() + 18)
                extrait = texte[debut:fin].strip().replace("\n", " ")
                alerte = None
                confiance = 0.94
                if valeur > regle["plafond"]:
                    alerte = (f"{valeur:g} {regle['unite']} dépasse le repère habituel "
                              f"({regle['plafond']}) — à confirmer par le client.")
                    confiance = 0.55
                if len(noms) > 1:
                    alerte = (alerte or "") + f" Plusieurs noms cités ({', '.join(noms[:3])}) : vérifier l'attribution."
                    confiance = min(confiance, 0.60)
                trouvees.append({
                    "salarie": salarie, "code": regle["code"], "libelle": regle["libelle"],
                    "valeur": valeur, "unite": regle["unite"], "confiance": confiance,
                    "extrait": f"…{extrait}…", "alerte": (alerte or "").strip() or None,
                })
                break
        return trouvees


class Depot:
    session_factory = None

    def _s(self):
        return (self.session_factory or db_mod.SessionLocal)()

    def recevoir(self, canal: str, expediteur: str, contenu: str,
                 dossier_code: str | None = None, periode: str | None = None) -> dict:
        periode = periode or date.today().strftime("%Y-%m")
        variables = AgentPaie().lire(contenu)
        with self._s() as s:
            dossier_id = None
            if dossier_code:
                d = s.query(Dossier).filter(Dossier.code == dossier_code).first()
                dossier_id = d.id if d else None
            confiances = [v["confiance"] for v in variables]
            msg = MessagePaie(
                dossier_id=dossier_id, canal=canal, expediteur=expediteur,
                recu_le=datetime.now().isoformat(timespec="seconds"), contenu=contenu,
                periode=periode, etat="propose" if variables else "a_lire",
                confiance=min(confiances) if confiances else None,
                remarque=None if variables else "Aucune variable reconnue : à lire à la main.",
            )
            s.add(msg)
            s.flush()
            for v in variables:
                s.add(VariablePaie(message_id=msg.id, **v))
            s.commit()
            return {"id": msg.id, "variables": len(variables),
                    "message": f"{len(variables)} variable(s) proposée(s)." if variables
                               else "Aucune variable reconnue : le message attend une lecture humaine."}

    def messages(self, periode: str = "", etat: str = "") -> list[dict]:
        with self._s() as s:
            q = s.query(MessagePaie)
            if periode:
                q = q.filter(MessagePaie.periode == periode)
            if etat:
                q = q.filter(MessagePaie.etat == etat)
            out = []
            for m in q.order_by(MessagePaie.id.desc()).all():
                d = s.get(Dossier, m.dossier_id) if m.dossier_id else None
                out.append({
                    "id": m.id, "canal": m.canal, "canal_libelle": CANAUX.get(m.canal, m.canal),
                    "expediteur": m.expediteur, "recu_le": m.recu_le, "contenu": m.contenu,
                    "periode": m.periode, "etat": m.etat, "confiance": m.confiance,
                    "remarque": m.remarque,
                    "dossier_code": d.code if d else None,
                    "raison_sociale": d.raison_sociale if d else None,
                    "variables": [{
                        "id": v.id, "salarie": v.salarie, "code": v.code, "libelle": v.libelle,
                        "valeur": v.valeur, "unite": v.unite, "confiance": v.confiance,
                        "extrait": v.extrait, "alerte": v.alerte, "validee": bool(v.validee),
                    } for v in m.variables],
                })
            return out

    def corriger(self, variable_id: int, valeur: float) -> dict:
        with self._s() as s:
            v = s.get(VariablePaie, variable_id)
            if v is None:
                raise LookupError("Variable introuvable.")
            if v.validee:
                raise ValueError("Variable déjà validée : elle ne peut plus être corrigée.")
            v.valeur = float(valeur)
            v.confiance = 1.0
            v.alerte = None
            v.extrait = (v.extrait or "") + " · corrigée à la main"
            s.commit()
            return {"id": v.id, "valeur": v.valeur}

    def valider(self, message_id: int) -> dict:
        with self._s() as s:
            m = s.get(MessagePaie, message_id)
            if m is None:
                raise LookupError("Message introuvable.")
            if not m.variables:
                raise ValueError("Rien à valider : aucune variable proposée.")
            for v in m.variables:
                v.validee = 1
            m.etat = "valide"
            s.commit()
            return {"id": m.id, "variables": len(m.variables), "message": "Variables validées."}

    def ecarter(self, message_id: int) -> dict:
        with self._s() as s:
            m = s.get(MessagePaie, message_id)
            if m is None:
                raise LookupError("Message introuvable.")
            m.etat = "ecarte"
            s.commit()
            return {"id": m.id, "message": "Message écarté."}

    def export_openpaye(self, periode: str | None = None) -> dict:
        """Le fichier attendu par le logiciel de paie. Seules les variables
        validées y figurent — une proposition non relue n'en sort jamais."""
        periode = periode or date.today().strftime("%Y-%m")
        lignes: list[dict] = []
        with self._s() as s:
            for m in s.query(MessagePaie).filter(MessagePaie.periode == periode,
                                                 MessagePaie.etat == "valide").all():
                d = s.get(Dossier, m.dossier_id) if m.dossier_id else None
                for v in m.variables:
                    lignes.append({"dossier": d.code if d else "?", "salarie": v.salarie,
                                   "code": v.code, "valeur": v.valeur, "unite": v.unite})
        entete = "dossier;salarie;code;valeur"
        corps = "\n".join(f"{l['dossier']};{l['salarie']};{l['code']};{l['valeur']:.2f}" for l in lignes)
        return {"periode": periode, "lignes": lignes, "nb": len(lignes),
                "fichier": f"variables_paie_{periode.replace('-', '')}.csv",
                "contenu": f"{entete}\n{corps}" if lignes else entete,
                "avertissement": None if lignes else
                "Aucune variable validée pour cette période : le fichier serait vide."}
