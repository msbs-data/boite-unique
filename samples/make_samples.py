"""Fabrique le jeu de démonstration : factures Factur-X réelles et mails .eml.

Aucune donnée réelle, aucun accès réseau. Les PDF produits sont de véritables
PDF à XML embarqué : le lecteur Factur-X de l'application les lit pour de bon.
"""

from __future__ import annotations

import sys
from datetime import date, timedelta
from decimal import Decimal
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid
from pathlib import Path

import pikepdf
from pikepdf import Name

RACINE = Path(__file__).resolve().parent
ENTRANT = RACINE.parent / "data" / "entrant"
DOMAINE = "cabinet-demo.fr"
CATCHALL = f"pieces@{DOMAINE}"

DOSSIERS = [
    ("VELLARD-TOI", "SARL Vellard Toitures", "vellard"),
    ("FERRAND-BOU", "Boulangerie Ferrand", "ferrand"),
    ("NEDJAR-GAR", "Garage Nedjar", "nedjar"),
    ("LOISEAU-CON", "Cabinet Loiseau Conseil", "loiseau"),
    ("BAKKALI-TRA", "Transports Bakkali", "bakkali"),
    ("KESSLER-FLE", "Fleuriste Kessler", "kessler"),
    ("OTTAVI-MEN", "Menuiserie Ottavi", "ottavi"),
]

CII = """<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>{numero}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">{jour}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:ID>{siren}</ram:ID>
        <ram:Name>{fournisseur}</ram:Name>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">{tva_num}</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty><ram:Name>{acheteur}</ram:Name></ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>{ht}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>{ht}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">{tva}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>{ttc}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>{ttc}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
"""


def _echapper(t: str) -> str:
    return t.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def pdf_facturx(lignes: list[str], xml: str) -> bytes:
    """Un PDF lisible à l'œil, portant son XML de facture en pièce jointe."""
    pdf = pikepdf.Pdf.new()
    page = pdf.add_blank_page(page_size=(595, 842))
    police = pdf.make_indirect(pikepdf.Dictionary(
        Type=Name.Font, Subtype=Name.Type1, BaseFont=Name.Helvetica))
    page.Resources = pikepdf.Dictionary(Font=pikepdf.Dictionary(F1=police))

    flux = ["BT /F1 11 Tf 14 TL 60 780 Td"]
    for ligne in lignes:
        flux.append(f"({_echapper(ligne)}) Tj T*")
    flux.append("ET")
    page.Contents = pdf.make_stream("\n".join(flux).encode("latin-1", "replace"))

    piece = pikepdf.AttachedFileSpec(pdf, xml.encode("utf-8"),
                                     mime_type="text/xml",
                                     description="Facture électronique Factur-X")
    pdf.attachments["factur-x.xml"] = piece

    tampon = pikepdf.io.BytesIO() if hasattr(pikepdf, "io") else None
    import io as _io
    tampon = _io.BytesIO()
    pdf.save(tampon)
    return tampon.getvalue()


def facture(numero, fournisseur, siren, tva_num, acheteur, ht, taux, jour):
    ht = Decimal(ht)
    tva = (ht * Decimal(taux)).quantize(Decimal("0.01"))
    ttc = ht + tva
    xml = CII.format(numero=numero, jour=jour.strftime("%Y%m%d"), siren=siren,
                     fournisseur=fournisseur, tva_num=tva_num, acheteur=acheteur,
                     ht=f"{ht:.2f}", tva=f"{tva:.2f}", ttc=f"{ttc:.2f}")
    lignes = [
        fournisseur, f"SIREN {siren} — TVA {tva_num}", "",
        f"FACTURE {numero}", f"Date : {jour:%d/%m/%Y}", f"Client : {acheteur}", "",
        f"Total HT ............ {ht:>10.2f} EUR",
        f"TVA {Decimal(taux)*100:.1f} % ......... {tva:>10.2f} EUR",
        f"Total TTC ........... {ttc:>10.2f} EUR", "",
        "Facture electronique Factur-X, profil EN 16931.",
        "Le XML est joint a ce PDF : il fait foi, l'image ne sert qu'a la lecture humaine.",
    ]
    return pdf_facturx(lignes, xml), ttc


def mail(alias: str | None, expediteur: str, sujet: str, corps: str,
         jointes: list[tuple[str, bytes, str]], jours: int,
         alias_dans: str = "X-Original-To") -> bytes:
    """Construit un .eml comme le livrerait une boîte attrape-tout."""
    msg = EmailMessage()
    msg["From"] = expediteur
    msg["Subject"] = sujet
    msg["Message-ID"] = make_msgid(domain=DOMAINE)
    msg["Date"] = format_datetime(
        __import__("datetime").datetime.now() - timedelta(days=jours))
    cible = f"{alias}@{DOMAINE}" if alias else None

    # Le cas réel : la boîte attrape-tout écrase Delivered-To, l'alias visé
    # ne subsiste que dans X-Original-To ou dans la clause « for » du Received.
    msg["Delivered-To"] = CATCHALL
    if cible and alias_dans == "X-Original-To":
        msg["X-Original-To"] = cible
        msg["To"] = cible
    elif cible and alias_dans == "Received":
        msg["To"] = f"Cabinet <{CATCHALL}>"
        msg["Received"] = (f"from mx.exemple.fr by mail.{DOMAINE} for <{cible}>; "
                           f"{format_datetime(__import__('datetime').datetime.now())}")
    else:
        msg["To"] = cible or f"comptabilite@{DOMAINE}"

    msg.set_content(corps)
    for nom, contenu, mime in jointes:
        grand, petit = mime.split("/")
        msg.add_attachment(contenu, maintype=grand, subtype=petit, filename=nom)
    return msg.as_bytes()


def main() -> int:
    ENTRANT.mkdir(parents=True, exist_ok=True)
    for ancien in ENTRANT.glob("*.eml"):
        ancien.unlink()
    aujourdhui = date.today()
    n = 0

    def ecrire(nom: str, contenu: bytes) -> None:
        nonlocal n
        (ENTRANT / nom).write_bytes(contenu)
        n += 1

    catalogue = [
        ("vellard", "SARL Vellard Toitures", "Point P Materiaux", "552100554",
         "FR40552100554", "FA-2026-4471", "1070.50", 3),
        ("vellard", "SARL Vellard Toitures", "Total Energies Marketing", "542051180",
         "FR27542051180", "TE-889201", "82.00", 3),
        ("ferrand", "Boulangerie Ferrand", "Grands Moulins de Paris", "662043851",
         "FR61662043851", "GMP-2026-0912", "1783.33", 3),
        ("nedjar", "Garage Nedjar", "Oscaro Pieces Auto", "451234567",
         "FR12451234567", "OSC-771204", "630.10", 4),
        ("loiseau", "Cabinet Loiseau Conseil", "OVH SAS", "424761419",
         "FR22424761419", "OVH-2026-33871", "179.00", 5),
        ("bakkali", "Transports Bakkali", "Michelin France", "855200507",
         "FR63855200507", "MIC-2026-1188", "3316.67", 6),
        ("kessler", "Fleuriste Kessler", "Marche de Rungis", "775664601",
         "FR83775664601", "RUN-4402", "510.37", 7),
        ("ottavi", "Menuiserie Ottavi", "Leroy Merlin Pro", "384560943",
         "FR90384560943", "LM-2026-77120", "1563.50", 8),
    ]

    for i, (alias, client, fournisseur, siren, tva_num, num, ht, jours) in enumerate(catalogue):
        pdf, ttc = facture(num, fournisseur, siren, tva_num, client, ht, "0.20",
                           aujourdhui - timedelta(days=jours))
        # Un mail sur trois n'expose l'alias que dans le Received : c'est le cas
        # qui casse les implémentations naïves.
        ou = "Received" if i % 3 == 2 else "X-Original-To"
        ecrire(f"{i:02d}_{alias}_facturx.eml", mail(
            alias, f"facturation@{fournisseur.split()[0].lower()}.fr",
            f"Facture {num}", f"Bonjour,\n\nVeuillez trouver la facture {num}.\n\nCordialement",
            [(f"{num}.pdf", pdf, "application/pdf")], jours, ou))

    photos_dir = RACINE / "photos"
    def _lire_photo(nom: str, fallback: bytes) -> bytes:
        p = photos_dir / nom
        return p.read_bytes() if p.exists() else fallback

    # Un ticket carburant photographié (vrai JPEG haute définition)
    ticket_carb = _lire_photo("ticket_totalenergies.jpg", b"\xff\xd8\xff\xe0" + b"JFIF ticket de caisse photographie" + b"\x00" * 512)
    ecrire("20_ferrand_ticket.eml", mail(
        "ferrand", "marie.ferrand@boulangerie-ferrand.fr", "Ticket essence",
        "Le ticket de ce matin, pris en photo.",
        [("ticket_totalenergies_gazole.jpg", ticket_carb, "image/jpeg")], 2))

    # Deux pièces jointes dans un seul mail pour Vellard : facture matériel + note de restaurant réelle
    pdf_a, _ = facture("FA-2026-4472", "Point P Materiaux", "552100554",
                       "FR40552100554", "SARL Vellard Toitures", "441.20", "0.20",
                       aujourdhui - timedelta(days=1))
    note_resto = _lire_photo("ticket_brasserie_commerce.jpg", b"\xff\xd8\xff\xe0" + b"JFIF note de frais restaurant" + b"\x00" * 320)
    ecrire("21_vellard_double.eml", mail(
        "vellard", "facturation@pointp.fr", "Facture et note de frais",
        "Deux pieces dans ce message.",
        [("FA-2026-4472.pdf", pdf_a, "application/pdf"),
         ("ticket_brasserie_commerce_lyon.jpg", note_resto, "image/jpeg")], 1))

    # Photo de bon de livraison Point.P pour Vellard
    bl_pointp = _lire_photo("facture_point_p.jpg", b"")
    if bl_pointp:
        ecrire("24_vellard_bon_livraison.eml", mail(
            "vellard", "chantier.melun@vellard-toitures.fr", "Bon de livraison ardoises Point P",
            "Photo du bon de livraison Point.P signe sur le chantier.",
            [("bon_livraison_point_p_toitures.jpg", bl_pointp, "image/jpeg")], 1))

    # Note de frais bistrot pour Vellard
    bistrot_img = _lire_photo("ticket_bistrot_saint_martin.jpg", b"")
    if bistrot_img:
        ecrire("25_vellard_bistrot.eml", mail(
            "vellard", "j.vellard@vellard-toitures.fr", "Note de frais Bistrot Saint-Martin",
            "Photo ticket dejeuner artisan.",
            [("ticket_bistrot_saint_martin.jpg", bistrot_img, "image/jpeg")], 1))

    # Le même mail renvoyé : doit être reconnu comme doublon, pas recréé.
    ecrire("22_ferrand_doublon.eml", mail(
        "ferrand", "compta@grandsmoulins.fr", "Facture GMP-2026-0912 (renvoi)",
        "Renvoi, sans reponse de votre part.",
        [("GMP-2026-0912.pdf",
          facture("GMP-2026-0912", "Grands Moulins de Paris", "662043851",
                  "FR61662043851", "Boulangerie Ferrand", "1783.33", "0.20",
                  aujourdhui - timedelta(days=3))[0], "application/pdf")], 1))

    # Un alias inconnu : quarantaine, jamais de rejet silencieux.
    ecrire("23_inconnu_quarantaine.eml", mail(
        None, "contact@nouveau-client.fr", "Mes pieces de septembre",
        "Bonjour, je vous envoie mes pieces.",
        [("scan001.pdf", b"%PDF-1.4\n% pas une facture structuree\n", "application/pdf")], 1))

    print(f"{n} mails ecrits dans {ENTRANT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
