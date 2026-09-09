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
    heures = Column(Float, nullable=False)
    taux_horaire = Column(Float, nullable=False)
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
    montant_ht = Column(Float, nullable=False, default=0.0)
    montant_tva = Column(Float, nullable=False, default=0.0)
    montant_ttc = Column(Float, nullable=False, default=0.0)
    # brouillon -> envoyee -> encaissee | partielle | impayee
    etat = Column(String(24), nullable=False, default="brouillon", index=True)
    envoyee_le = Column(String(20), nullable=True)
    envoyee_a = Column(String(255), nullable=True)
    relances = Column(Integer, nullable=False, default=0)

    dossier = relationship("Dossier")
    lignes_temps = relationship("SaisieTemps", back_populates="facture")

    __table_args__ = (
        UniqueConstraint("dossier_id", "periode", name="uq_facture_dossier_periode"),
    )


class LigneReleve(Base):
    """Une ligne du relevé bancaire du cabinet.

    Le rapprochement se fait sur le relevé que la banque fournit, pas par une
    interface bancaire tierce : aucune donnée ne sort du cabinet, et il n'y a
    aucun abonnement à un agrégateur.
    """

    __tablename__ = "ligne_releve"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    jour = Column(String(10), nullable=False, index=True)
    libelle = Column(String(255), nullable=False)
    montant = Column(Float, nullable=False)
    reference = Column(String(64), nullable=True)
    facture_id = Column(Integer, ForeignKey("facture.id", ondelete="SET NULL"), nullable=True, index=True)
    # exact | approchant | aucun
    rapprochement = Column(String(16), nullable=False, default="aucun", index=True)

    facture = relationship("Facture")
