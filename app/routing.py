"""Routage d'une pièce vers son dossier client, à partir des en-têtes du mail.

Code de production. La boîte du cabinet est une boîte attrape-tout : l'adresse
réellement visée par le client ne se lit pas au même endroit selon le fournisseur
de messagerie, et `Delivered-To` porte souvent l'adresse de la boîte elle-même
plutôt que l'alias d'origine. On interroge donc les en-têtes dans l'ordre où ils
sont fiables, et on écarte systématiquement l'adresse attrape-tout.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from email.message import Message
from email.utils import getaddresses

# Du plus fiable au moins fiable. `Received` est traité à part : l'adresse y est
# dans la clause « for <...> » du saut le plus récent.
ORDRE_ENTETES = ("X-Original-To", "Delivered-To", "Envelope-To", "To", "Cc")

_RECEIVED_FOR = re.compile(r"\bfor\s+<([^>]+)>", re.IGNORECASE)


@dataclass(frozen=True)
class Routage:
    alias: str | None
    entete: str | None
    examinees: tuple[str, ...]

    @property
    def en_quarantaine(self) -> bool:
        return self.alias is None


def _normaliser(adresse: str) -> str:
    return adresse.strip().strip("<>").lower()


def adresses_candidates(msg: Message) -> list[tuple[str, str]]:
    """Rend les couples (en-tête, adresse) dans l'ordre de fiabilité, sans doublon."""
    vues: set[str] = set()
    candidates: list[tuple[str, str]] = []

    def ajouter(entete: str, brut: str) -> None:
        adresse = _normaliser(brut)
        if adresse and "@" in adresse and adresse not in vues:
            vues.add(adresse)
            candidates.append((entete, adresse))

    for entete in ORDRE_ENTETES[:3]:
        for valeur in msg.get_all(entete, []):
            ajouter(entete, valeur)

    # `Received` est empilé du plus récent au plus ancien : le premier saut est
    # celui qui a livré dans la boîte, c'est lui qui porte l'alias visé.
    for valeur in msg.get_all("Received", []):
        trouve = _RECEIVED_FOR.search(valeur)
        if trouve:
            ajouter("Received", trouve.group(1))

    for entete in ("To", "Cc"):
        for _, adresse in getaddresses(msg.get_all(entete, [])):
            ajouter(entete, adresse)

    return candidates


def router(msg: Message, alias_connus: dict[str, str], attrape_tout: set[str]) -> Routage:
    """Rend le dossier visé, ou une quarantaine si aucun alias connu n'apparaît.

    `alias_connus` associe une adresse complète à un identifiant de dossier.
    `attrape_tout` liste les adresses de la boîte elle-même, à ignorer.
    """
    attrape_tout = {_normaliser(a) for a in attrape_tout}
    candidates = adresses_candidates(msg)

    for entete, adresse in candidates:
        if adresse in attrape_tout:
            continue
        dossier = alias_connus.get(adresse)
        if dossier:
            return Routage(dossier, entete, tuple(a for _, a in candidates))

    return Routage(None, None, tuple(a for _, a in candidates))
