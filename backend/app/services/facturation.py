"""Le temps passé, les factures d'honoraires, et leur encaissement.

Trois règles portent tout le reste :

  1. Une heure déjà facturée ne repart jamais dans une facture suivante.
     C'est la même garantie que le non-rejeu de l'export Sage, et elle se
     tient au même endroit : un champ sur la ligne, pas une convention.
  2. Le rapprochement se fait sur le relevé bancaire du cabinet, pas par une
     interface bancaire tierce. Aucun agrégateur, aucun abonnement, aucune
     donnée qui sort.
  3. L'outil ne touche jamais l'argent. Il prépare, il constate, il relance.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from ..core import database as db_mod
from ..models.dossier import Dossier
from ..models.facturation import Facture, LigneReleve, SaisieTemps

TAUX_TVA = 0.20
DELAI_PAIEMENT_JOURS = 30
TOLERANCE_RAPPROCHEMENT = 0.01


def _periode_courante() -> str:
    return date.today().strftime("%Y-%m")


def _bornes(periode: str) -> tuple[str, str]:
    an, mois = (int(x) for x in periode.split("-"))
    dernier = calendar.monthrange(an, mois)[1]
    return f"{periode}-01", f"{periode}-{dernier:02d}"


def _arrondi(v: float) -> float:
    return round(v + 1e-9, 2)


@dataclass
class Depot:
    """Accès aux données de facturation, dans le style du dépôt existant."""

    session_factory = None

    def _s(self) -> Session:
        return (self.session_factory or db_mod.SessionLocal)()

    # ---------------------------------------------------------------- temps

    def saisir_temps(self, dossier_code: str, jour: str, heures: float,
                     taux_horaire: float | None = None, libelle: str | None = None,
                     saisi_par: str | None = None) -> int:
        with self._s() as s:
            d = s.query(Dossier).filter(Dossier.code == dossier_code).first()
            if d is None:
                raise ValueError(f"Dossier inconnu : {dossier_code}")
            taux = taux_horaire if taux_horaire is not None else taux_par_defaut(d.code)
            ligne = SaisieTemps(dossier_id=d.id, jour=jour, heures=float(heures),
                                taux_horaire=float(taux), libelle=libelle, saisi_par=saisi_par)
            s.add(ligne)
            s.commit()
            return ligne.id

    def supprimer_temps(self, ligne_id: int) -> bool:
        with self._s() as s:
            l = s.get(SaisieTemps, ligne_id)
            if l is None:
                return False
            if l.facture_id is not None:
                raise ValueError("Cette ligne est déjà facturée : elle ne peut plus être supprimée.")
            s.delete(l)
            s.commit()
            return True

    def modifier_temps(self, ligne_id: int, heures: float | None = None,
                       taux_horaire: float | None = None, jour: str | None = None,
                       libelle: str | None = None) -> dict:
        """Corrige une ligne de temps. Refusé dès qu'elle est facturée.

        Une heure partie en facture ne se réécrit pas : la facture serait fausse
        sans que rien ne le signale. Pour corriger après coup, il faut annuler
        la facture — et ça, c'est une décision comptable, pas un clic.
        """
        with self._s() as s:
            l = s.get(SaisieTemps, ligne_id)
            if l is None:
                raise LookupError("Ligne introuvable.")
            if l.facture_id is not None:
                raise ValueError(
                    "Cette ligne est déjà portée par une facture : elle ne peut plus être modifiée."
                )
            if heures is not None:
                if heures <= 0 or heures > 24:
                    raise ValueError("Le nombre d'heures doit être compris entre 0 et 24.")
                l.heures = float(heures)
            if taux_horaire is not None:
                if taux_horaire <= 0:
                    raise ValueError("Le coût horaire doit être positif.")
                l.taux_horaire = float(taux_horaire)
            if jour is not None:
                l.jour = jour
            if libelle is not None:
                l.libelle = libelle or None
            s.commit()
            return {"id": l.id, "heures": l.heures, "taux_horaire": l.taux_horaire,
                    "jour": l.jour, "libelle": l.libelle,
                    "montant": _arrondi(l.heures * l.taux_horaire)}

    def appliquer_taux(self, dossier_code: str, taux_horaire: float,
                       periode: str | None = None) -> dict:
        """Applique un coût horaire à toutes les lignes non facturées d'un dossier."""
        if taux_horaire <= 0:
            raise ValueError("Le coût horaire doit être positif.")
        periode = periode or _periode_courante()
        deb, fin = _bornes(periode)
        with self._s() as s:
            d = s.query(Dossier).filter(Dossier.code == dossier_code).first()
            if d is None:
                raise LookupError(f"Dossier inconnu : {dossier_code}")
            lignes = (s.query(SaisieTemps)
                       .filter(SaisieTemps.dossier_id == d.id, SaisieTemps.facture_id.is_(None),
                               SaisieTemps.jour >= deb, SaisieTemps.jour <= fin).all())
            for l in lignes:
                l.taux_horaire = float(taux_horaire)
            s.commit()
            return {"dossier": dossier_code, "lignes": len(lignes),
                    "message": f"{len(lignes)} ligne(s) repassée(s) à {taux_horaire:.2f} €/h. "
                               "Les lignes déjà facturées n'ont pas bougé."}

    def attribuer(self, ligne_id: int, facture_id: int | None) -> dict:
        """Rattache — ou détache — une ligne de relevé à une facture, à la main.

        C'est la sortie de secours des cas que le rapprochement automatique
        refuse de trancher : un acompte, ou deux factures au même montant.
        """
        with self._s() as s:
            l = s.get(LigneReleve, ligne_id)
            if l is None:
                raise LookupError("Ligne de relevé introuvable.")
            if facture_id is None:
                l.facture_id, l.rapprochement = None, "aucun"
            else:
                f = s.get(Facture, facture_id)
                if f is None:
                    raise LookupError("Facture introuvable.")
                l.facture_id, l.rapprochement = f.id, "manuel"
            s.commit()
        self._recalculer_etats()
        return {"ligne": ligne_id, "facture": facture_id,
                "message": "Attribution enregistrée." if facture_id else "Attribution retirée."}

    def _recalculer_etats(self) -> None:
        with self._s() as s:
            for f in s.query(Facture).filter(Facture.etat != "brouillon").all():
                encaisse = sum(x.montant for x in
                               s.query(LigneReleve).filter(LigneReleve.facture_id == f.id).all())
                if encaisse >= f.montant_ttc - TOLERANCE_RAPPROCHEMENT:
                    f.etat = "encaissee"
                elif encaisse > 0:
                    f.etat = "partielle"
                elif date.fromisoformat(f.echeance_le) < date.today():
                    f.etat = "impayee"
                else:
                    f.etat = "envoyee"
            s.commit()

    def temps(self, periode: str | None = None, dossier_code: str = "") -> list[dict]:
        periode = periode or _periode_courante()
        deb, fin = _bornes(periode)
        with self._s() as s:
            q = (s.query(SaisieTemps, Dossier)
                  .join(Dossier, Dossier.id == SaisieTemps.dossier_id)
                  .filter(SaisieTemps.jour >= deb, SaisieTemps.jour <= fin))
            if dossier_code:
                q = q.filter(Dossier.code == dossier_code)
            lignes = []
            for t, d in q.order_by(SaisieTemps.jour.desc(), SaisieTemps.id.desc()).all():
                lignes.append({
                    "id": t.id, "dossier_code": d.code, "raison_sociale": d.raison_sociale,
                    "jour": t.jour, "heures": t.heures, "taux_horaire": t.taux_horaire,
                    "montant": _arrondi(t.heures * t.taux_horaire),
                    "libelle": t.libelle, "saisi_par": t.saisi_par,
                    "facturee": t.facture_id is not None, "facture_id": t.facture_id,
                })
            return lignes

    # ------------------------------------------------------------- synthèse

    def synthese(self, periode: str | None = None) -> dict:
        """Par client : heures, coût horaire, montant du mois, et la ventilation
        par semaine — c'est la vue à partir de laquelle on décide de facturer."""
        periode = periode or _periode_courante()
        deb, fin = _bornes(periode)
        with self._s() as s:
            dossiers = s.query(Dossier).filter(Dossier.actif == True).order_by(Dossier.raison_sociale).all()  # noqa: E712
            factures = {f.dossier_id: f for f in s.query(Facture).filter(Facture.periode == periode).all()}
            lignes, tot_h, tot_ht, tot_af = [], 0.0, 0.0, 0.0
            for d in dossiers:
                ts = (s.query(SaisieTemps)
                       .filter(SaisieTemps.dossier_id == d.id,
                               SaisieTemps.jour >= deb, SaisieTemps.jour <= fin).all())
                if not ts:
                    continue
                heures = sum(t.heures for t in ts)
                montant = sum(t.heures * t.taux_horaire for t in ts)
                a_facturer = sum(t.heures * t.taux_horaire for t in ts if t.facture_id is None)
                h_a_facturer = sum(t.heures for t in ts if t.facture_id is None)
                taux = _arrondi(montant / heures) if heures else 0.0

                semaines: dict[str, dict] = {}
                for t in ts:
                    j = date.fromisoformat(t.jour)
                    cle = f"S{j.isocalendar().week:02d}"
                    e = semaines.setdefault(cle, {"semaine": cle, "heures": 0.0, "montant": 0.0,
                                                  "du": (j - timedelta(days=j.weekday())).isoformat()})
                    e["heures"] += t.heures
                    e["montant"] = _arrondi(e["montant"] + t.heures * t.taux_horaire)

                f = factures.get(d.id)
                lignes.append({
                    "dossier_code": d.code, "raison_sociale": d.raison_sociale,
                    "heures": _arrondi(heures), "taux_horaire": taux,
                    "montant_ht": _arrondi(montant),
                    "heures_a_facturer": _arrondi(h_a_facturer),
                    "montant_a_facturer": _arrondi(a_facturer),
                    "jours": _arrondi(heures / 7),          # journée de 7 heures
                    "semaines": sorted(semaines.values(), key=lambda x: x["semaine"]),
                    "facture_numero": f.numero if f else None,
                    "facture_etat": f.etat if f else None,
                })
                tot_h += heures
                tot_ht += montant
                tot_af += a_facturer
            return {
                "periode": periode, "lignes": lignes,
                "total_heures": _arrondi(tot_h),
                "total_ht": _arrondi(tot_ht),
                "total_tva": _arrondi(tot_ht * TAUX_TVA),
                "total_ttc": _arrondi(tot_ht * (1 + TAUX_TVA)),
                "total_a_facturer": _arrondi(tot_af),
                "dossiers_pointes": len(lignes),
            }

    # ------------------------------------------------------------- factures

    def _numero(self, s: Session, periode: str) -> str:
        n = s.query(Facture).count() + 1
        return f"FH-{periode.replace('-', '')}-{n:03d}"

    def generer(self, periode: str | None = None, dossiers: list[str] | None = None) -> dict:
        """Une facture par dossier, sur le temps non encore facturé de la période."""
        periode = periode or _periode_courante()
        deb, fin = _bornes(periode)
        emise = date.today()
        echeance = emise + timedelta(days=DELAI_PAIEMENT_JOURS)
        creees, ignores = [], []
        with self._s() as s:
            q = s.query(Dossier).filter(Dossier.actif == True)  # noqa: E712
            if dossiers:
                q = q.filter(Dossier.code.in_(dossiers))
            for d in q.order_by(Dossier.raison_sociale).all():
                ts = (s.query(SaisieTemps)
                       .filter(SaisieTemps.dossier_id == d.id, SaisieTemps.facture_id.is_(None),
                               SaisieTemps.jour >= deb, SaisieTemps.jour <= fin).all())
                if not ts:
                    continue
                if s.query(Facture).filter(Facture.dossier_id == d.id, Facture.periode == periode).first():
                    ignores.append({"dossier": d.code, "motif": "une facture existe déjà pour cette période"})
                    continue
                heures = sum(t.heures for t in ts)
                ht = _arrondi(sum(t.heures * t.taux_horaire for t in ts))
                tva = _arrondi(ht * TAUX_TVA)
                f = Facture(numero=self._numero(s, periode), dossier_id=d.id, periode=periode,
                            emise_le=emise.isoformat(), echeance_le=echeance.isoformat(),
                            heures=_arrondi(heures), montant_ht=ht, montant_tva=tva,
                            montant_ttc=_arrondi(ht + tva), etat="brouillon")
                s.add(f)
                s.flush()
                for t in ts:
                    t.facture_id = f.id          # l'heure est consommée, définitivement
                creees.append({"numero": f.numero, "dossier": d.code,
                               "raison_sociale": d.raison_sociale, "heures": f.heures,
                               "montant_ttc": f.montant_ttc})
            s.commit()
        return {"periode": periode, "creees": creees, "ignorees": ignores,
                "message": f"{len(creees)} facture(s) générée(s)."}

    def factures(self, periode: str = "", etat: str = "") -> list[dict]:
        with self._s() as s:
            q = (s.query(Facture, Dossier).join(Dossier, Dossier.id == Facture.dossier_id))
            if periode:
                q = q.filter(Facture.periode == periode)
            if etat:
                q = q.filter(Facture.etat == etat)
            out = []
            for f, d in q.order_by(Facture.id.desc()).all():
                encaisse = sum(l.montant for l in
                               s.query(LigneReleve).filter(LigneReleve.facture_id == f.id).all())
                retard = 0
                if f.etat in ("envoyee", "partielle", "impayee"):
                    retard = max(0, (date.today() - date.fromisoformat(f.echeance_le)).days)
                out.append({
                    "id": f.id, "numero": f.numero, "dossier_code": d.code,
                    "raison_sociale": d.raison_sociale, "alias": d.alias, "periode": f.periode,
                    "emise_le": f.emise_le, "echeance_le": f.echeance_le, "heures": f.heures,
                    "montant_ht": f.montant_ht, "montant_tva": f.montant_tva,
                    "montant_ttc": f.montant_ttc, "etat": f.etat,
                    "envoyee_le": f.envoyee_le, "envoyee_a": f.envoyee_a,
                    "relances": f.relances, "montant_encaisse": _arrondi(encaisse),
                    "reste_du": _arrondi(f.montant_ttc - encaisse), "jours_retard": retard,
                })
            return out

    def detail(self, facture_id: int) -> dict:
        """Tout ce qu'il faut pour éditer la facture : l'en-tête et son détail."""
        with self._s() as s:
            f = s.get(Facture, facture_id)
            if f is None:
                raise LookupError("Facture introuvable.")
            d = s.get(Dossier, f.dossier_id)
            lignes = (s.query(SaisieTemps)
                       .filter(SaisieTemps.facture_id == f.id)
                       .order_by(SaisieTemps.jour).all())
            encaisse = sum(x.montant for x in
                           s.query(LigneReleve).filter(LigneReleve.facture_id == f.id).all())
            return {
                "numero": f.numero, "periode": f.periode,
                "emise_le": f.emise_le, "echeance_le": f.echeance_le,
                "etat": f.etat, "relances": f.relances,
                "client": {"code": d.code, "raison_sociale": d.raison_sociale, "alias": d.alias},
                "lignes": [{"jour": l.jour, "libelle": l.libelle or "Travaux comptables",
                            "heures": l.heures, "taux_horaire": l.taux_horaire,
                            "montant": _arrondi(l.heures * l.taux_horaire)} for l in lignes],
                "heures": f.heures, "montant_ht": f.montant_ht,
                "taux_tva": TAUX_TVA, "montant_tva": f.montant_tva,
                "montant_ttc": f.montant_ttc,
                "montant_encaisse": _arrondi(encaisse),
                "reste_du": _arrondi(f.montant_ttc - encaisse),
            }

    def envoyer(self, ids: list[int]) -> dict:
        """Marque les factures comme envoyées.

        L'envoi réel n'est pas effectué dans cette démonstration : aucun message
        ne part. En production, le courriel est remis au serveur du cabinet, et
        c'est ici qu'on enregistre l'accusé.
        """
        horodatage = datetime.now().isoformat(timespec="seconds")
        envoyees = []
        with self._s() as s:
            for fid in ids:
                f = s.get(Facture, fid)
                if f is None or f.etat != "brouillon":
                    continue
                d = s.get(Dossier, f.dossier_id)
                f.etat = "envoyee"
                f.envoyee_le = horodatage
                f.envoyee_a = d.alias if d else None
                envoyees.append({"numero": f.numero, "a": f.envoyee_a})
            s.commit()
        return {"envoyees": envoyees, "simule": True,
                "message": f"{len(envoyees)} facture(s) marquée(s) comme envoyée(s). "
                           "Aucun message n'a réellement été expédié."}

    # -------------------------------------------------- relevé et encaissement

    def importer_releve(self, lignes: list[dict]) -> int:
        with self._s() as s:
            n = 0
            for l in lignes:
                deja = (s.query(LigneReleve)
                         .filter(LigneReleve.jour == l["jour"],
                                 LigneReleve.libelle == l["libelle"],
                                 LigneReleve.montant == float(l["montant"])).first())
                if deja:
                    continue
                s.add(LigneReleve(jour=l["jour"], libelle=l["libelle"],
                                  montant=float(l["montant"]), reference=l.get("reference")))
                n += 1
            s.commit()
            return n

    def rapprocher(self) -> dict:
        """Confronte les lignes du relevé aux factures envoyées.

        Deux niveaux : le numéro de facture cité dans le libellé ou la référence
        emporte la décision ; à défaut, un montant identique au centime près sur
        une facture encore due suffit à proposer un rapprochement.
        """
        exacts = approchants = 0
        with self._s() as s:
            libres = s.query(LigneReleve).filter(LigneReleve.facture_id.is_(None),
                                                 LigneReleve.montant > 0).all()
            ouvertes = s.query(Facture).filter(Facture.etat.in_(["envoyee", "partielle", "impayee"])).all()
            for l in libres:
                champ = f"{l.libelle} {l.reference or ''}".upper()
                trouvee = next((f for f in ouvertes if f.numero.upper() in champ), None)
                if trouvee is not None:
                    l.facture_id, l.rapprochement = trouvee.id, "exact"
                    exacts += 1
                    continue
                candidates = [f for f in ouvertes
                              if abs(f.montant_ttc - l.montant) <= TOLERANCE_RAPPROCHEMENT]
                if len(candidates) == 1:
                    l.facture_id, l.rapprochement = candidates[0].id, "approchant"
                    approchants += 1
            s.flush()
            # L'état de chaque facture découle de ce qui a été encaissé.
            for f in s.query(Facture).filter(Facture.etat != "brouillon").all():
                encaisse = sum(x.montant for x in
                               s.query(LigneReleve).filter(LigneReleve.facture_id == f.id).all())
                if encaisse >= f.montant_ttc - TOLERANCE_RAPPROCHEMENT:
                    f.etat = "encaissee"
                elif encaisse > 0:
                    f.etat = "partielle"
                elif date.fromisoformat(f.echeance_le) < date.today():
                    f.etat = "impayee"
                else:
                    f.etat = "envoyee"
            s.commit()
        return {"exacts": exacts, "approchants": approchants,
                "message": f"{exacts} rapprochement(s) certain(s), {approchants} par le montant seul."}

    def releve(self) -> list[dict]:
        with self._s() as s:
            out = []
            for l in s.query(LigneReleve).order_by(LigneReleve.jour.desc(), LigneReleve.id.desc()).all():
                f = s.get(Facture, l.facture_id) if l.facture_id else None
                out.append({"id": l.id, "jour": l.jour, "libelle": l.libelle,
                            "montant": l.montant, "reference": l.reference,
                            "rapprochement": l.rapprochement,
                            "facture_numero": f.numero if f else None})
            return out

    def simuler_releve(self) -> dict:
        """Fabrique l'arrivée du relevé bancaire du mois, pour la démonstration.

        Trois issues volontairement différentes : un virement qui cite le numéro
        de facture, un virement qui ne le cite pas mais dont le montant tombe
        juste, et un acompte partiel. En production, ces lignes viennent du
        relevé que la banque fournit — rien n'est fabriqué.
        """
        with self._s() as s:
            envoyees = (s.query(Facture, Dossier)
                         .join(Dossier, Dossier.id == Facture.dossier_id)
                         .filter(Facture.etat.in_(["envoyee", "impayee"]))
                         .order_by(Facture.montant_ttc.desc()).all())
        if not envoyees:
            return {"message": "Aucune facture envoyée : rien à encaisser.", "lignes": 0}

        jour = date.today().isoformat()
        lignes: list[dict] = []
        for rang, (f, d) in enumerate(envoyees):
            nom = d.raison_sociale.upper()[:28]
            if rang == 0:          # acompte partiel
                lignes.append({"jour": jour, "libelle": f"VIR SEPA {nom} ACOMPTE",
                               "montant": _arrondi(f.montant_ttc / 2), "reference": None})
            elif rang % 3 == 1:    # le numéro de facture est cité
                lignes.append({"jour": jour, "libelle": f"VIR SEPA {nom} {f.numero}",
                               "montant": f.montant_ttc, "reference": f.numero})
            elif rang % 3 == 2:    # le montant seul
                lignes.append({"jour": jour, "libelle": f"VIR SEPA {nom}",
                               "montant": f.montant_ttc, "reference": None})
            # le reste ne paie pas : ce sont les impayés à relancer
        n = self.importer_releve(lignes)
        return {"message": f"{n} mouvement(s) reçus sur le compte du cabinet.", "lignes": n}

    def relancer(self, ids: list[int]) -> dict:
        relancees = []
        with self._s() as s:
            for fid in ids:
                f = s.get(Facture, fid)
                if f is None or f.etat not in ("envoyee", "partielle", "impayee"):
                    continue
                f.relances += 1
                relancees.append({"numero": f.numero, "relances": f.relances})
            s.commit()
        return {"relancees": relancees, "simule": True,
                "message": f"{len(relancees)} relance(s) enregistrée(s). Aucun message n'a été expédié."}


TAUX = {"VELLARD-TOI": 95, "FERRAND-BOU": 95, "NEDJAR-GAR": 95,
        "LOISEAU-CON": 110, "BAKKALI-TRA": 110, "KESSLER-FLE": 95, "OTTAVI-MEN": 95}


def taux_par_defaut(code: str) -> float:
    return float(TAUX.get(code, 95))
