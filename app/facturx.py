"""Lecture des factures au format structuré : Factur-X, et par extension CII.

Code de production. Une facture Factur-X est un PDF/A-3 qui embarque son propre
XML. Quand ce XML est présent, on le lit — on ne regarde jamais l'image. C'est
la brique qui prend de la valeur : à partir du 1er septembre 2027, les clients
du cabinet émettront tous dans ce format.

Couverture : profils MINIMUM à EXTENDED, en-tête de facture. Les lignes de détail
ne sont pas extraites — l'outil prépare des écritures, il ne refait pas la facture.
"""

from __future__ import annotations

import io
from dataclasses import dataclass, asdict
from datetime import date
from decimal import Decimal, InvalidOperation

import pikepdf
from lxml import etree

# Noms de fichier normalisés du XML embarqué, par ordre de fréquence.
NOMS_XML = ("factur-x.xml", "zugferd-invoice.xml", "xrechnung.xml", "factur-x.XML")

NS = {
    "rsm": "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
    "ram": "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
    "udt": "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
}


class PasDeXML(Exception):
    """Le PDF ne contient aucun XML de facture : il faudra passer par l'image."""


@dataclass
class FactureStructuree:
    numero: str | None
    date_facture: date | None
    fournisseur: str | None
    tva_intracom: str | None
    siren: str | None
    montant_ht: Decimal | None
    montant_tva: Decimal | None
    montant_ttc: Decimal | None
    devise: str
    profil: str | None

    def as_dict(self) -> dict:
        d = asdict(self)
        d["date_facture"] = self.date_facture.isoformat() if self.date_facture else None
        for cle in ("montant_ht", "montant_tva", "montant_ttc"):
            d[cle] = str(d[cle]) if d[cle] is not None else None
        return d

    @property
    def coherent(self) -> bool:
        """HT + TVA = TTC, à un centime près. Le seul contrôle qui vaille."""
        if None in (self.montant_ht, self.montant_tva, self.montant_ttc):
            return False
        return abs((self.montant_ht + self.montant_tva) - self.montant_ttc) <= Decimal("0.01")


def extraire_xml(pdf_octets: bytes) -> bytes:
    """Sort le XML embarqué d'un PDF/A-3. Lève PasDeXML s'il n'y en a pas."""
    with pikepdf.open(io.BytesIO(pdf_octets)) as pdf:
        try:
            attaches = pdf.attachments
        except AttributeError:  # pragma: no cover - pikepdf ancien
            raise PasDeXML("cette version de pikepdf n'expose pas les pièces jointes")

        noms = list(attaches.keys())
        for attendu in NOMS_XML:
            for nom in noms:
                if nom.lower() == attendu.lower():
                    return attaches[nom].get_file().read_bytes()
        # Repli : un seul fichier joint et il ressemble à du XML.
        for nom in noms:
            if nom.lower().endswith(".xml"):
                return attaches[nom].get_file().read_bytes()
    raise PasDeXML("aucun XML de facture dans ce PDF")


def _texte(racine, chemin: str) -> str | None:
    noeud = racine.find(chemin, NS)
    if noeud is None or noeud.text is None:
        return None
    valeur = noeud.text.strip()
    return valeur or None


def _decimal(racine, chemin: str) -> Decimal | None:
    brut = _texte(racine, chemin)
    if brut is None:
        return None
    try:
        return Decimal(brut)
    except InvalidOperation:
        return None


def _date(racine, chemin: str) -> date | None:
    brut = _texte(racine, chemin)
    if not brut or len(brut) != 8 or not brut.isdigit():
        return None
    try:
        return date(int(brut[:4]), int(brut[4:6]), int(brut[6:8]))
    except ValueError:
        return None


def lire_cii(xml_octets: bytes) -> FactureStructuree:
    """Lit un CrossIndustryInvoice et en tire les champs d'en-tête."""
    racine = etree.fromstring(xml_octets)

    accord = "rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement"
    reglement = "rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeSettlement"
    totaux = f"{reglement}/ram:SpecifiedTradeSettlementHeaderMonetarySummation"
    vendeur = f"{accord}/ram:SellerTradeParty"

    tva = siren = None
    for enr in racine.findall(f"{vendeur}/ram:SpecifiedTaxRegistration/ram:ID", NS):
        if enr.get("schemeID") == "VA":
            tva = (enr.text or "").strip() or None
    for ident in racine.findall(f"{vendeur}/ram:ID", NS):
        valeur = (ident.text or "").strip()
        if len(valeur) == 9 and valeur.isdigit():
            siren = valeur

    return FactureStructuree(
        numero=_texte(racine, "rsm:ExchangedDocument/ram:ID"),
        date_facture=_date(racine, "rsm:ExchangedDocument/ram:IssueDateTime/udt:DateTimeString"),
        fournisseur=_texte(racine, f"{vendeur}/ram:Name"),
        tva_intracom=tva,
        siren=siren,
        montant_ht=_decimal(racine, f"{totaux}/ram:TaxBasisTotalAmount"),
        montant_tva=_decimal(racine, f"{totaux}/ram:TaxTotalAmount"),
        montant_ttc=_decimal(racine, f"{totaux}/ram:GrandTotalAmount"),
        devise=_texte(racine, f"{reglement}/ram:InvoiceCurrencyCode") or "EUR",
        profil=_texte(racine, "rsm:ExchangedDocumentContext"
                              "/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID"),
    )


def lire_pdf(pdf_octets: bytes) -> FactureStructuree:
    """Chemin nominal : PDF Factur-X en entrée, champs en sortie, sans OCR."""
    return lire_cii(extraire_xml(pdf_octets))
