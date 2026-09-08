"""La lecture Factur-X — deuxième zone imposée par la spec."""

import sys
from decimal import Decimal
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE / "samples"))
from app.facturx import PasDeXML, lire_cii, lire_pdf  # noqa: E402
from make_samples import facture  # noqa: E402


def test_facture_lue_sans_ocr():
    pdf, ttc = facture("FA-2026-4471", "Point P Materiaux", "552100554",
                       "FR40552100554", "SARL Vellard Toitures", "1070.50", "0.20",
                       __import__("datetime").date(2026, 9, 4))
    f = lire_pdf(pdf)
    assert f.numero == "FA-2026-4471"
    assert f.fournisseur == "Point P Materiaux"
    assert f.date_facture.isoformat() == "2026-09-04"
    assert f.montant_ht == Decimal("1070.50")
    assert f.montant_tva == Decimal("214.10")
    assert f.montant_ttc == Decimal("1284.60") == ttc
    assert f.devise == "EUR"
    assert f.siren == "552100554" and f.tva_intracom == "FR40552100554"
    assert f.profil == "urn:cen.eu:en16931:2017"


def test_controle_de_coherence():
    """HT + TVA = TTC : le seul contrôle qui décide de l'état de la pièce."""
    pdf, _ = facture("X", "F", "552100554", "FR40552100554", "C", "100.00", "0.20",
                     __import__("datetime").date(2026, 1, 1))
    assert lire_pdf(pdf).coherent


def test_incoherence_detectee():
    from app.facturx import FactureStructuree
    f = FactureStructuree("X", None, "F", None, None,
                          Decimal("100.00"), Decimal("20.00"), Decimal("130.00"),
                          "EUR", None)
    assert not f.coherent


def test_pdf_sans_xml_leve_pas_de_xml():
    import pikepdf, io
    pdf = pikepdf.Pdf.new()
    pdf.add_blank_page()
    tampon = io.BytesIO()
    pdf.save(tampon)
    with pytest.raises(PasDeXML):
        lire_pdf(tampon.getvalue())


def test_champs_absents_ne_font_pas_tomber_la_lecture():
    minimal = b"""<?xml version="1.0"?>
    <rsm:CrossIndustryInvoice
      xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
      xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100">
      <rsm:ExchangedDocument><ram:ID>SEUL-NUMERO</ram:ID></rsm:ExchangedDocument>
    </rsm:CrossIndustryInvoice>"""
    f = lire_cii(minimal)
    assert f.numero == "SEUL-NUMERO"
    assert f.montant_ttc is None and not f.coherent
