from __future__ import annotations

from sqlalchemy import Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from ..core.database import Base


class MessagePaie(Base):
    """Un message reçu d'un client, quel qu'en soit le canal.

    Le gestionnaire de paie ne va pas chercher l'information : elle arrive
    là où le client a l'habitude d'écrire — messagerie instantanée, courriel,
    Telegram. L'agent lit, propose, et n'écrit jamais tout seul.
    """

    __tablename__ = "message_paie"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    dossier_id = Column(Integer, ForeignKey("dossier.id", ondelete="CASCADE"), nullable=True, index=True)
    canal = Column(String(24), nullable=False, index=True)      # whatsapp | gmail | telegram
    expediteur = Column(String(160), nullable=False)
    recu_le = Column(String(20), nullable=False, index=True)
    contenu = Column(Text, nullable=False)
    periode = Column(String(7), nullable=True, index=True)
    # a_lire -> propose -> valide | ecarte
    etat = Column(String(16), nullable=False, default="a_lire", index=True)
    confiance = Column(Float, nullable=True)
    remarque = Column(String(255), nullable=True)

    dossier = relationship("Dossier")
    variables = relationship("VariablePaie", back_populates="message", cascade="all, delete-orphan")


class VariablePaie(Base):
    """Une variable proposée par l'agent, avec ce qui l'a produite."""

    __tablename__ = "variable_paie"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("message_paie.id", ondelete="CASCADE"), nullable=False, index=True)
    salarie = Column(String(120), nullable=False)
    code = Column(String(16), nullable=False)                   # HS025, ABS100, PAN010, PRI200
    libelle = Column(String(120), nullable=False)
    valeur = Column(Float, nullable=False)
    unite = Column(String(16), nullable=False, default="heures")
    confiance = Column(Float, nullable=False, default=0.0)
    extrait = Column(String(255), nullable=True)                # le bout de phrase d'origine
    alerte = Column(String(255), nullable=True)
    validee = Column(Integer, nullable=False, default=0)

    message = relationship("MessagePaie", back_populates="variables")
