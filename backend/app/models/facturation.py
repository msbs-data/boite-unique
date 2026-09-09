from __future__ import annotations

from sqlalchemy import Column, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from ..core.database import Base


class SaisieTemps(Base):
    """Une ligne de temps passé sur un dossier client."""

    __tablename__ = "saisie_temps"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    dossier_id = Column(Integer, ForeignKey("dossier.id", ondelete="CASCADE"), nullable=False, index=True)
    jour = Column(String(10), nullable=False, index=True)          # AAAA-MM-JJ
    # Les heures sont une quantité, pas un montant : un flottant est légitime.
    heures = Column(Float, nullable=False)
    # Les montants sont en centimes entiers. Le suffixe _c est la seule
    # protection contre une multiplication faite dans la mauvaise unité.
    taux_horaire_c = Column(Integer, nullable=False)
    libelle = Column(String(255), nullable=True)
    saisi_par = Column(String(120), nullable=True)
    # Nul tant que la ligne n'est pas facturée. C'est ce champ qui garantit
    # qu'une heure déjà facturée ne repart jamais dans une facture suivante.
    facture_id = Column(Integer, ForeignKey("facture.id", ondelete="SET NULL"), nullable=True, index=True)

    dossier = relationship("Dossier")
    facture = relationship("Facture", back_populates="lignes_temps")


class Facture(Base):
    """Une facture d'honoraires émise par le cabinet à l'un de ses clients."""

    __tablename__ = "facture"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    numero = Column(String(32), nullable=False, unique=True, index=True)
    dossier_id = Column(Integer, ForeignKey("dossier.id", ondelete="CASCADE"), nullable=False, index=True)
    periode = Column(String(7), nullable=False, index=True)        # AAAA-MM
    emise_le = Column(String(10), nullable=False)
    echeance_le = Column(String(10), nullable=False)
    heures = Column(Float, nullable=False, default=0.0)
    montant_ht_c = Column(Integer, nullable=False, default=0)
    montant_tva_c = Column(Integer, nullable=False, default=0)
    montant_ttc_c = Column(Integer, nullable=False, default=0)
    # brouillon -> envoyee -> encaissee | partielle | impayee
    etat = Column(String(24), nullable=False, default="brouillon", index=True)
    envoyee_le = Column(String(20), nullable=True)
    envoyee_a = Column(String(255), nullable=True)
    relances = Column(Integer, nullable=False, default=0)

    # §2 · Figé à l'émission. Le jour où la raison sociale ou l'adresse du
    # cabinet change, les pièces déjà émises gardent ce qu'elles portaient :
    # corriger un document remis, c'est falsifier une pièce.
    emetteur_nom = Column(String(160), nullable=True)
    emetteur_adresse = Column(String(255), nullable=True)
    emetteur_siren = Column(String(32), nullable=True)
    emetteur_tva = Column(String(32), nullable=True)
    emetteur_iban = Column(String(64), nullable=True)
    # Figé aussi : la règle d'arrondi appliquée, pour qu'une réédition dise
    # comment le total a été obtenu.
    regle_arrondi = Column(String(64), nullable=True)

    dossier = relationship("Dossier")
    lignes_temps = relationship("SaisieTemps", back_populates="facture")

    __table_args__ = (
        UniqueConstraint("dossier_id", "periode", name="uq_facture_dossier_periode"),
    )


class LigneReleve(Base):
    """Une ligne du relevé bancaire du cabinet. Montant en centimes.

    Le rapprochement se fait sur le relevé que la banque fournit, pas par une
    interface bancaire tierce : aucune donnée ne sort du cabinet, et il n'y a
    aucun abonnement à un agrégateur.
    """

    __tablename__ = "ligne_releve"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    jour = Column(String(10), nullable=False, index=True)
    libelle = Column(String(255), nullable=False)
    montant_c = Column(Integer, nullable=False)
    reference = Column(String(64), nullable=True)
    facture_id = Column(Integer, ForeignKey("facture.id", ondelete="SET NULL"), nullable=True, index=True)
    # exact | approchant | aucun
    rapprochement = Column(String(16), nullable=False, default="aucun", index=True)

    facture = relationship("Facture")


class CompteurPiece(Base):
    """Le plus grand numéro jamais attribué, par famille de pièces.

    Volontairement séparé des pièces elles-mêmes : c'est ce qui garantit
    qu'une suppression ne libère pas un numéro déjà remis à un client.
    """

    __tablename__ = "compteur_piece"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cle = Column(String(64), nullable=False, unique=True, index=True)
    dernier = Column(Integer, nullable=False, default=0)


class JournalAudit(Base):
    """Qui a fait quoi, quand, sur les écritures sensibles (§8).

    Les objets sont désignés par un libellé, pas par une clé étrangère :
    un objet supprimé ne doit pas emporter son histoire avec lui.
    """

    __tablename__ = "journal_audit"

    id = Column(Integer, primary_key=True, autoincrement=True)
    horodatage = Column(String(20), nullable=False, index=True)
    acteur = Column(String(120), nullable=False)
    action = Column(String(64), nullable=False, index=True)
    objet = Column(String(64), nullable=False, index=True)
    reference = Column(String(160), nullable=False)
    detail = Column(String(512), nullable=True)
