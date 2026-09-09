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
from sqlalchemy import text

from ..models.facturation import (
    CompteurPiece, Facture, JournalAudit, LigneReleve, SaisieTemps,
)

TAUX_TVA_MILLIEMES = 200          # 20,0 % — en millièmes, pour rester entier
DELAI_PAIEMENT_JOURS = 30

# Tous les montants circulent en centimes entiers à l'intérieur du service.
# La conversion en euros se fait à la sortie, et nulle part ailleurs.


def en_centimes(euros: float) -> int:
    return int(round(euros * 100))


def en_euros(centimes: int) -> float:
    return round(centimes / 100, 2)


def montant_ligne_c(heures: float, taux_c: int) -> int:
    """Heures × taux. On convertit d'abord, on multiplie ensuite (§3)."""
    return int(round(heures * taux_c))


def _periode_courante() -> str:
    return date.today().strftime("%Y-%m")


def _bornes(periode: str) -> tuple[str, str]:
    an, mois = (int(x) for x in periode.split("-"))
    dernier = calendar.monthrange(an, mois)[1]
    return f"{periode}-01", f"{periode}-{dernier:02d}"


# §3 · La règle d'arrondi, écrite parce qu'elle ne se devine pas.
# La TVA est calculée sur le total hors taxes de la facture, à taux unique,
# arrondie au centime le plus proche — et non ligne par ligne puis sommée.
# Les deux méthodes peuvent différer d'un centime ; celle-ci fait que le
# total TTC du document est toujours exactement HT + TVA affichés.
REGLE_ARRONDI = "TVA au taux unique sur le total HT, arrondie au centime"


def _tva_c(ht_c: int) -> int:
    return int(round(ht_c * TAUX_TVA_MILLIEMES / 1000))


def _maintenant() -> str:
    return datetime.now().isoformat(timespec="seconds")


def journaliser(s, acteur: str, action: str, objet: str, reference: str,
                detail: str | None = None) -> None:
    """§8 · Une écriture sensible laisse une trace. Rétro-ajouté, un journal
    ne reconstitue pas le passé : il s'écrit dès le premier jour."""
    s.add(JournalAudit(horodatage=_maintenant(), acteur=acteur, action=action,
                       objet=objet, reference=reference, detail=detail))


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
                                taux_horaire_c=en_centimes(taux), libelle=libelle,
                                saisi_par=saisi_par)
            s.add(ligne)
            s.commit()
            return ligne.id

    def supprimer_temps(self, ligne_id: int, acteur: str = "M. Loiseau") -> bool:
        with self._s() as s:
            l = s.get(SaisieTemps, ligne_id)
            if l is None:
                return False
            if l.facture_id is not None:
                raise ValueError("Cette ligne est déjà facturée : elle ne peut plus être supprimée.")
            journaliser(s, acteur, "suppression_temps", "saisie_temps", str(l.id),
                        f"{l.jour} · {l.heures:g} h × {en_euros(l.taux_horaire_c):.2f} €")
            s.delete(l)
            s.commit()
            return True

    def modifier_temps(self, ligne_id: int, heures: float | None = None,
                       taux_horaire: float | None = None, jour: str | None = None,
                       libelle: str | None = None, acteur: str = "M. Loiseau") -> dict:
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
            avant = f"{l.heures:g} h × {en_euros(l.taux_horaire_c):.2f} €"
            if heures is not None:
                if heures <= 0 or heures > 24:
                    raise ValueError("Le nombre d'heures doit être compris entre 0 et 24.")
                l.heures = float(heures)
            if taux_horaire is not None:
                if taux_horaire <= 0:
                    raise ValueError("Le coût horaire doit être positif.")
                l.taux_horaire_c = en_centimes(taux_horaire)
            if jour is not None:
                l.jour = jour
            if libelle is not None:
                l.libelle = libelle or None
            journaliser(s, acteur, "correction_temps", "saisie_temps", str(l.id),
                        f"{avant} → {l.heures:g} h × {en_euros(l.taux_horaire_c):.2f} €")
            s.commit()
            return {"id": l.id, "heures": l.heures,
                    "taux_horaire": en_euros(l.taux_horaire_c),
                    "jour": l.jour, "libelle": l.libelle,
                    "montant": en_euros(montant_ligne_c(l.heures, l.taux_horaire_c))}

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
                l.taux_horaire_c = en_centimes(taux_horaire)
            s.commit()
            return {"dossier": dossier_code, "lignes": len(lignes),
                    "message": f"{len(lignes)} ligne(s) repassée(s) à {taux_horaire:.2f} €/h. "
                               "Les lignes déjà facturées n'ont pas bougé."}

    def attribuer(self, ligne_id: int, facture_id: int | None,
                  acteur: str = "M. Loiseau") -> dict:
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
            journaliser(s, acteur, "attribution_manuelle", "ligne_releve", str(l.id),
                        f"{en_euros(l.montant_c):.2f} € → "
                        f"{f.numero if facture_id else 'détachée'}")
            s.commit()
        self._recalculer_etats()
        return {"ligne": ligne_id, "facture": facture_id,
                "message": "Attribution enregistrée." if facture_id else "Attribution retirée."}

    def _recalculer_etats(self) -> None:
        with self._s() as s:
            for f in s.query(Facture).filter(Facture.etat != "brouillon").all():
                encaisse_c = sum(x.montant_c for x in
                                 s.query(LigneReleve).filter(LigneReleve.facture_id == f.id).all())
                if encaisse_c >= f.montant_ttc_c:
                    f.etat = "encaissee"
                elif encaisse_c > 0:
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
                    "jour": t.jour, "heures": t.heures,
                    "taux_horaire": en_euros(t.taux_horaire_c),
                    "montant": en_euros(montant_ligne_c(t.heures, t.taux_horaire_c)),
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
            lignes, tot_h, tot_ht_c, tot_af_c = [], 0.0, 0, 0
            for d in dossiers:
                ts = (s.query(SaisieTemps)
                       .filter(SaisieTemps.dossier_id == d.id,
                               SaisieTemps.jour >= deb, SaisieTemps.jour <= fin).all())
                if not ts:
                    continue
                heures = sum(t.heures for t in ts)
                montant_c = sum(montant_ligne_c(t.heures, t.taux_horaire_c) for t in ts)
                a_facturer_c = sum(montant_ligne_c(t.heures, t.taux_horaire_c)
                                   for t in ts if t.facture_id is None)
                h_a_facturer = sum(t.heures for t in ts if t.facture_id is None)
                taux_c = int(round(montant_c / heures)) if heures else 0

                semaines: dict[str, dict] = {}
                for t in ts:
                    j = date.fromisoformat(t.jour)
                    cle = f"S{j.isocalendar().week:02d}"
                    e = semaines.setdefault(cle, {"semaine": cle, "heures": 0.0, "montant": 0.0,
                                                  "du": (j - timedelta(days=j.weekday())).isoformat()})
                    e["heures"] += t.heures
                    e["montant"] = en_euros(en_centimes(e["montant"])
                                            + montant_ligne_c(t.heures, t.taux_horaire_c))

                f = factures.get(d.id)
                lignes.append({
                    "dossier_code": d.code, "raison_sociale": d.raison_sociale,
                    "heures": round(heures, 2), "taux_horaire": en_euros(taux_c),
                    "montant_ht": en_euros(montant_c),
                    "heures_a_facturer": round(h_a_facturer, 2),
                    "montant_a_facturer": en_euros(a_facturer_c),
                    "jours": round(heures / 7, 2),          # journée de 7 heures
                    "semaines": sorted(semaines.values(), key=lambda x: x["semaine"]),
                    "facture_numero": f.numero if f else None,
                    "facture_etat": f.etat if f else None,
                })
                tot_h += heures
                tot_ht_c += montant_c
                tot_af_c += a_facturer_c
            return {
                "periode": periode, "lignes": lignes,
                "total_heures": round(tot_h, 2),
                "total_ht": en_euros(tot_ht_c),
                "total_tva": en_euros(_tva_c(tot_ht_c)),
                "total_ttc": en_euros(tot_ht_c + _tva_c(tot_ht_c)),
                "total_a_facturer": en_euros(tot_af_c),
                "dossiers_pointes": len(lignes),
            }

    # ------------------------------------------------------------- factures

    def _numero(self, s: Session, periode: str) -> str:
        """Repère persistant du plus grand numéro jamais attribué (§2).

        Un compteur déduit de l'existant — count() ou MAX — réattribue le
        numéro d'une facture supprimée : deux pièces remises au client
        porteraient le même. Un trou après suppression est normal, et
        volontairement non rebouché.
        """
        cle = f"facture_honoraires:{periode}"
        if s.query(CompteurPiece).filter(CompteurPiece.cle == cle).first() is None:
            s.add(CompteurPiece(cle=cle, dernier=0))
            s.flush()
        # §1 · Un seul ordre SQL lit et incrémente. `with_for_update()` aurait
        # été silencieusement ignoré par SQLite, donc sans effet le jour où
        # quelqu'un rebascule de moteur : deux factures simultanées auraient
        # pris le même numéro sans qu'aucune erreur ne le dise.
        rang = s.execute(
            text("UPDATE compteur_piece SET dernier = dernier + 1 "
                 "WHERE cle = :cle RETURNING dernier"),
            {"cle": cle},
        ).scalar_one()
        return f"FH-{periode.replace('-', '')}-{rang:03d}"

    def generer(self, periode: str | None = None, dossiers: list[str] | None = None,
                acteur: str = "M. Loiseau") -> dict:
        """Une facture par dossier, sur le temps non encore facturé de la période."""
        periode = periode or _periode_courante()
        if dossiers is not None and len(dossiers) == 0:
            return {"periode": periode, "creees": [], "ignorees": [],
                    "message": "Aucun dossier sélectionné : rien n'a été facturé."}
        deb, fin = _bornes(periode)
        emise = date.today()
        echeance = emise + timedelta(days=DELAI_PAIEMENT_JOURS)
        creees, ignores = [], []
        with self._s() as s:
            q = s.query(Dossier).filter(Dossier.actif == True)  # noqa: E712
            # §3 : « aucun dossier choisi » n'est pas « tous les dossiers ».
            # None = paramètre absent ; [] = choix explicite de ne rien facturer.
            if dossiers is not None:
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
                ht_c = sum(montant_ligne_c(t.heures, t.taux_horaire_c) for t in ts)
                tva_c = _tva_c(ht_c)
                em = emetteur_courant()
                f = Facture(numero=self._numero(s, periode), dossier_id=d.id, periode=periode,
                            emise_le=emise.isoformat(), echeance_le=echeance.isoformat(),
                            heures=round(heures, 2), montant_ht_c=ht_c, montant_tva_c=tva_c,
                            montant_ttc_c=ht_c + tva_c, etat="brouillon",
                            emetteur_nom=em["nom"], emetteur_adresse=em["adresse"],
                            emetteur_siren=em["siren"], emetteur_tva=em["tva"],
                            emetteur_iban=em["iban"], regle_arrondi=REGLE_ARRONDI)
                s.add(f)
                s.flush()
                for t in ts:
                    t.facture_id = f.id          # l'heure est consommée, définitivement
                journaliser(s, acteur, "emission_facture", "facture", f.numero,
                            f"{d.raison_sociale} · {heures:g} h · {en_euros(ht_c + tva_c):.2f} € TTC")
                creees.append({"numero": f.numero, "dossier": d.code,
                               "raison_sociale": d.raison_sociale, "heures": f.heures,
                               "montant_ttc": en_euros(f.montant_ttc_c)})
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
                encaisse_c = sum(l.montant_c for l in
                                 s.query(LigneReleve).filter(LigneReleve.facture_id == f.id).all())
                retard = 0
                if f.etat in ("envoyee", "partielle", "impayee"):
                    retard = max(0, (date.today() - date.fromisoformat(f.echeance_le)).days)
                out.append({
                    "id": f.id, "numero": f.numero, "dossier_code": d.code,
                    "raison_sociale": d.raison_sociale, "alias": d.alias, "periode": f.periode,
                    "emise_le": f.emise_le, "echeance_le": f.echeance_le, "heures": f.heures,
                    "montant_ht": en_euros(f.montant_ht_c),
                    "montant_tva": en_euros(f.montant_tva_c),
                    "montant_ttc": en_euros(f.montant_ttc_c), "etat": f.etat,
                    "envoyee_le": f.envoyee_le, "envoyee_a": f.envoyee_a,
                    "relances": f.relances, "montant_encaisse": en_euros(encaisse_c),
                    "reste_du": en_euros(f.montant_ttc_c - encaisse_c), "jours_retard": retard,
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
            encaisse_c = sum(x.montant_c for x in
                             s.query(LigneReleve).filter(LigneReleve.facture_id == f.id).all())
            return {
                "numero": f.numero, "periode": f.periode,
                "emetteur": {
                    "nom": f.emetteur_nom or emetteur_courant()["nom"],
                    "adresse": f.emetteur_adresse or emetteur_courant()["adresse"],
                    "siren": f.emetteur_siren or emetteur_courant()["siren"],
                    "tva": f.emetteur_tva or emetteur_courant()["tva"],
                    "iban": f.emetteur_iban or emetteur_courant()["iban"],
                },
                "regle_arrondi": f.regle_arrondi or REGLE_ARRONDI,
                "emise_le": f.emise_le, "echeance_le": f.echeance_le,
                "etat": f.etat, "relances": f.relances,
                "client": {"code": d.code, "raison_sociale": d.raison_sociale, "alias": d.alias},
                "lignes": [{"jour": l.jour, "libelle": l.libelle or "Travaux comptables",
                            "heures": l.heures,
                            "taux_horaire": en_euros(l.taux_horaire_c),
                            "montant": en_euros(montant_ligne_c(l.heures, l.taux_horaire_c))}
                           for l in lignes],
                "heures": f.heures, "montant_ht": en_euros(f.montant_ht_c),
                "taux_tva": TAUX_TVA_MILLIEMES / 1000,
                "montant_tva": en_euros(f.montant_tva_c),
                "montant_ttc": en_euros(f.montant_ttc_c),
                "montant_encaisse": en_euros(encaisse_c),
                "reste_du": en_euros(f.montant_ttc_c - encaisse_c),
            }

    def envoyer(self, ids: list[int], acteur: str = "M. Loiseau") -> dict:
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
                journaliser(s, acteur, "envoi_facture", "facture", f.numero, f"à {f.envoyee_a}")
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
                montant_c = en_centimes(float(l["montant"]))
                deja = (s.query(LigneReleve)
                         .filter(LigneReleve.jour == l["jour"],
                                 LigneReleve.libelle == l["libelle"],
                                 LigneReleve.montant_c == montant_c).first())
                if deja:
                    continue
                s.add(LigneReleve(jour=l["jour"], libelle=l["libelle"],
                                  montant_c=montant_c, reference=l.get("reference")))
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
                                                 LigneReleve.montant_c > 0).all()
            ouvertes = s.query(Facture).filter(Facture.etat.in_(["envoyee", "partielle", "impayee"])).all()
            for l in libres:
                champ = f"{l.libelle} {l.reference or ''}".upper()
                trouvee = next((f for f in ouvertes if f.numero.upper() in champ), None)
                if trouvee is not None:
                    l.facture_id, l.rapprochement = trouvee.id, "exact"
                    exacts += 1
                    continue
                # En centimes entiers, « au centime près » devient une égalité
                # stricte : plus aucune tolérance de flottant à régler (§3).
                candidates = [f for f in ouvertes if f.montant_ttc_c == l.montant_c]
                if len(candidates) == 1:
                    l.facture_id, l.rapprochement = candidates[0].id, "approchant"
                    approchants += 1
            s.flush()
            # L'état de chaque facture découle de ce qui a été encaissé.
            for f in s.query(Facture).filter(Facture.etat != "brouillon").all():
                encaisse_c = sum(x.montant_c for x in
                                 s.query(LigneReleve).filter(LigneReleve.facture_id == f.id).all())
                if encaisse_c >= f.montant_ttc_c:
                    f.etat = "encaissee"
                elif encaisse_c > 0:
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
                            "montant": en_euros(l.montant_c), "reference": l.reference,
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
                         .order_by(Facture.montant_ttc_c.desc()).all())
        if not envoyees:
            return {"message": "Aucune facture envoyée : rien à encaisser.", "lignes": 0}

        jour = date.today().isoformat()
        lignes: list[dict] = []
        for rang, (f, d) in enumerate(envoyees):
            nom = d.raison_sociale.upper()[:28]
            if rang == 0:          # acompte partiel
                lignes.append({"jour": jour, "libelle": f"VIR SEPA {nom} ACOMPTE",
                               "montant": en_euros(f.montant_ttc_c // 2), "reference": None})
            elif rang % 3 == 1:    # le numéro de facture est cité
                lignes.append({"jour": jour, "libelle": f"VIR SEPA {nom} {f.numero}",
                               "montant": en_euros(f.montant_ttc_c), "reference": f.numero})
            elif rang % 3 == 2:    # le montant seul
                lignes.append({"jour": jour, "libelle": f"VIR SEPA {nom}",
                               "montant": en_euros(f.montant_ttc_c), "reference": None})
            # le reste ne paie pas : ce sont les impayés à relancer
        n = self.importer_releve(lignes)
        return {"message": f"{n} mouvement(s) reçus sur le compte du cabinet.", "lignes": n}

    def audit(self, limite: int = 200) -> list[dict]:
        with self._s() as s:
            return [{"id": j.id, "horodatage": j.horodatage, "acteur": j.acteur,
                     "action": j.action, "objet": j.objet, "reference": j.reference,
                     "detail": j.detail}
                    for j in s.query(JournalAudit)
                              .order_by(JournalAudit.id.desc()).limit(limite).all()]

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


def emetteur_courant() -> dict:
    """L'identité du cabinet au moment présent. Recopiée sur chaque facture
    à son émission, jamais relue ensuite pour une pièce déjà partie (§2)."""
    from ..core.config import settings
    return {
        "nom": getattr(settings, "CABINET_NOM", "Cabinet Loiseau Conseil"),
        "adresse": getattr(settings, "CABINET_ADRESSE", "14 rue des Tanneurs · 77000 Melun"),
        "siren": getattr(settings, "CABINET_SIREN", "912 445 771"),
        "tva": getattr(settings, "CABINET_TVA", "FR38912445771"),
        "iban": getattr(settings, "CABINET_IBAN", "FR76 3000 4008 2800 0123 4567 890"),
    }


TAUX = {"VELLARD-TOI": 95, "FERRAND-BOU": 95, "NEDJAR-GAR": 95,
        "LOISEAU-CON": 110, "BAKKALI-TRA": 110, "KESSLER-FLE": 95, "OTTAVI-MEN": 95}


def taux_par_defaut(code: str) -> float:
    return float(TAUX.get(code, 95))
