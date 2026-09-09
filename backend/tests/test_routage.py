"""Le routage par alias — tests unitaires."""

import email
import email.policy
from app.services.routing import router

ALIAS = {"vellard@cabinet.fr": "VELLARD-TOI", "ferrand@cabinet.fr": "FERRAND-BOU"}
CATCHALL = {"pieces@cabinet.fr"}


def msg(entetes: str) -> email.message.Message:
    return email.message_from_string(entetes + "\r\n\r\ncorps", policy=email.policy.default)


def test_alias_dans_x_original_to():
    r = router(
        msg("Delivered-To: pieces@cabinet.fr\r\nX-Original-To: vellard@cabinet.fr\r\nTo: pieces@cabinet.fr"),
        ALIAS,
        CATCHALL,
    )
    assert r.alias == "VELLARD-TOI" and r.entete == "X-Original-To"


def test_attrape_tout_ignore_meme_en_premier():
    r = router(msg("Delivered-To: pieces@cabinet.fr\r\nTo: ferrand@cabinet.fr"), ALIAS, CATCHALL)
    assert r.alias == "FERRAND-BOU" and r.entete == "To"


def test_alias_seulement_dans_le_received():
    r = router(
        msg(
            "Received: from mx.exemple.fr by mail.cabinet.fr for <vellard@cabinet.fr>;\r\n"
            " Mon, 7 Sep 2026 09:00:00 +0200\r\n"
            "Delivered-To: pieces@cabinet.fr\r\nTo: Cabinet <pieces@cabinet.fr>"
        ),
        ALIAS,
        CATCHALL,
    )
    assert r.alias == "VELLARD-TOI" and r.entete == "Received"


def test_alias_en_copie():
    r = router(msg("To: pieces@cabinet.fr\r\nCc: ferrand@cabinet.fr"), ALIAS, CATCHALL)
    assert r.alias == "FERRAND-BOU"


def test_casse_et_nom_affiche_indifferents():
    r = router(msg('To: "Vellard Toitures" <VELLARD@Cabinet.FR>'), ALIAS, CATCHALL)
    assert r.alias == "VELLARD-TOI"


def test_alias_inconnu_part_en_quarantaine_jamais_en_rejet():
    r = router(msg("To: inconnu@cabinet.fr\r\nDelivered-To: pieces@cabinet.fr"), ALIAS, CATCHALL)
    assert r.en_quarantaine and "inconnu@cabinet.fr" in r.examinees


def test_priorite_au_plus_fiable_quand_deux_alias_apparaissent():
    r = router(msg("X-Original-To: vellard@cabinet.fr\r\nTo: ferrand@cabinet.fr"), ALIAS, CATCHALL)
    assert r.alias == "VELLARD-TOI"


def test_aucune_adresse_du_tout():
    r = router(msg("Subject: rien"), ALIAS, CATCHALL)
    assert r.en_quarantaine and r.examinees == ()
