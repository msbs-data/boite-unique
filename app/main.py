"""L'application du cabinet — démonstration exécutable.

Un seul écran, un seul mot de passe, une seule machine. Ce que voit le comptable
ne parle jamais de conteneurs, de files ou de traitements : des pièces, des
dossiers et des écritures.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import FastAPI, Form, Request, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import config as cfg
from .ingest import traiter_mail
from .sage import ProfilSage, construire, rendre_csv
from .samples_bootstrap import amorcer
from .store import DepotSQLite

app = FastAPI(title="Le cabinet", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
gabarits = Jinja2Templates(directory=Path(__file__).parent / "templates")

depot = DepotSQLite(cfg.BASE)
amorcer(depot)


def euro(v) -> str:
    try:
        if v in (None, "", 0, "0"):
            return "—"
        n = float(v)
    except Exception:
        return "—"
    return f"{n:,.2f} €".replace(",", " ").replace(".", ",")


def jour_court(iso: str | None) -> str:
    if not iso:
        return "—"
    mois = ["janv.", "févr.", "mars", "avril", "mai", "juin", "juil.",
            "août", "sept.", "oct.", "nov.", "déc."]
    try:
        a, m, j = iso[:10].split("-")
        return f"{int(j)} {mois[int(m) - 1]}"
    except (ValueError, IndexError):
        return iso[:10]


gabarits.env.filters["euro"] = euro
gabarits.env.filters["jour"] = jour_court


def _restants() -> list[Path]:
    """Les mails du dossier entrant qui n'ont pas encore été relevés."""
    deja = {p["nom_fichier"] for p in depot.pieces()}
    restants = []
    for fichier in sorted(cfg.ENTRANT.glob("*.eml")):
        marque = cfg.DONNEES / ".releves" / fichier.name
        if not marque.exists():
            restants.append(fichier)
    return restants


def _marquer_releve(fichier: Path) -> None:
    (cfg.DONNEES / ".releves").mkdir(parents=True, exist_ok=True)
    (cfg.DONNEES / ".releves" / fichier.name).write_text("relevé")


def _contexte(request: Request, requete: str, etat: str, dossier: str, message=None) -> dict:
    pieces = depot.pieces(requete, etat, dossier)
    return {
        "request": request, "pieces": pieces, "requete": requete, "etat": etat,
        "dossier": dossier, "dossiers": depot.dossiers(), "compteurs": depot.compteurs(),
        "restants": len(_restants()), "message": message,
        "utilisateur": cfg.UTILISATEUR, "domaine": cfg.DOMAINE,
    }


@app.get("/", response_class=HTMLResponse)
def accueil(request: Request, q: str = "", etat: str = "", dossier: str = ""):
    return gabarits.TemplateResponse(request, "pieces.html", _contexte(request, q, etat, dossier))


@app.get("/lignes", response_class=HTMLResponse)
def lignes(request: Request, q: str = "", etat: str = "", dossier: str = ""):
    """Recherche à la frappe. Renvoie le corps du tableau, rien d'autre."""
    return gabarits.TemplateResponse(request, "_lignes.html", _contexte(request, q, etat, dossier))


@app.post("/recevoir")
def recevoir(request: Request, tout: str = Form("")):
    restants = _restants()
    if not restants:
        return RedirectResponse("/?vide=1", status_code=303)
    a_traiter = restants if tout else restants[:1]
    comptes = []
    for fichier in a_traiter:
        compte = traiter_mail(fichier.read_bytes(), depot, cfg.ATTRAPE_TOUT, cfg.IMAGES)
        _marquer_releve(fichier)
        comptes.append(compte)
    return RedirectResponse(f"/?recu={len(comptes)}", status_code=303)


TAILLE_MAX = 25 * 1024 * 1024
SUFFIXES_ACCEPTES = {".eml", ".pdf", ".jpg", ".jpeg", ".png", ".heic", ".tif", ".tiff", ".txt"}


@app.post("/deposer")
async def deposer(fichier: UploadFile = File(...), dossier: str = Form("")):
    """Dépôt direct pendant la démonstration : un .eml, ou un PDF pour un dossier."""
    contenu = await fichier.read(TAILLE_MAX + 1)
    if len(contenu) > TAILLE_MAX:
        return RedirectResponse("/?erreur=taille", status_code=303)
    nom = Path(fichier.filename or "depot").name
    if Path(nom).suffix.lower() not in SUFFIXES_ACCEPTES:
        return RedirectResponse("/?erreur=format", status_code=303)
    if nom.lower().endswith(".eml"):
        traiter_mail(contenu, depot, cfg.ATTRAPE_TOUT, cfg.IMAGES)
        return RedirectResponse("/?depot=1", status_code=303)

    alias = next((d["alias"] for d in depot.dossiers() if d["code"] == dossier), None)
    if not alias:
        return RedirectResponse("/?erreur=dossier", status_code=303)

    from email.message import EmailMessage
    msg = EmailMessage()
    msg["From"] = "depot-manuel@cabinet"
    msg["Subject"] = f"Dépôt manuel — {nom}"
    msg["X-Original-To"] = alias
    msg["To"] = alias
    msg.set_content("Pièce déposée depuis l'application.")
    grand, _, petit = (fichier.content_type or "application/octet-stream").partition("/")
    msg.add_attachment(contenu, maintype=grand, subtype=petit or "octet-stream", filename=nom)
    traiter_mail(msg.as_bytes(), depot, cfg.ATTRAPE_TOUT, cfg.IMAGES)
    return RedirectResponse("/?depot=1", status_code=303)


@app.get("/quarantaine", response_class=HTMLResponse)
def quarantaine(request: Request):
    return gabarits.TemplateResponse(request, "quarantaine.html", {
        "request": request, "lignes": depot.quarantaine(),
        "dossiers": depot.dossiers(), "compteurs": depot.compteurs(),
        "utilisateur": cfg.UTILISATEUR, "domaine": cfg.DOMAINE,
    })


@app.post("/valider")
def valider(piece: int = Form(...)):
    depot.valider(piece, cfg.UTILISATEUR)
    return RedirectResponse("/?valide=1", status_code=303)


@app.post("/exporter")
def exporter():
    export = construire(depot.pieces(etat="lue"))
    if not export.lignes:
        return RedirectResponse("/?export=vide", status_code=303)
    cfg.EXPORTS.mkdir(parents=True, exist_ok=True)
    (cfg.EXPORTS / export.fichier).write_bytes(rendre_csv(export))
    depot.marquer_exportees(export.pieces, export.fichier)
    return RedirectResponse(f"/?export={len(export.pieces)}", status_code=303)


@app.get("/exports/{nom}")
def telecharger(nom: str):
    chemin = cfg.EXPORTS / Path(nom).name
    if not chemin.exists():
        return Response("Fichier introuvable", status_code=404)
    return Response(chemin.read_bytes(), media_type="text/csv; charset=windows-1252",
                    headers={"Content-Disposition": f'attachment; filename="{chemin.name}"'})


@app.get("/apercu", response_class=HTMLResponse)
def apercu(request: Request):
    """Ce que Sage recevra, avant de l'écrire. Le geste qui vaut la démonstration."""
    export = construire(depot.pieces(etat="lue"))
    profil = ProfilSage()
    return gabarits.TemplateResponse(request, "apercu.html", {
        "request": request, "export": export, "profil": profil,
        "csv": rendre_csv(export).decode("cp1252")[:4000],
        "derniers": depot.exports()[:5], "compteurs": depot.compteurs(),
        "utilisateur": cfg.UTILISATEUR, "domaine": cfg.DOMAINE,
    })


@app.get("/piece/{piece_id}")
def image(piece_id: int):
    p = depot.piece(piece_id)
    if not p or not p.get("chemin_image"):
        return Response("Pièce sans image", status_code=404)
    chemin = (cfg.IMAGES / Path(p["chemin_image"]).name).resolve()
    if not chemin.is_relative_to(cfg.IMAGES.resolve()) or not chemin.exists():
        return Response("Image introuvable", status_code=404)
    suffixe = chemin.suffix.lower()
    types = {".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
             ".png": "image/png", ".txt": "text/plain; charset=utf-8"}
    return Response(chemin.read_bytes(), media_type=types.get(suffixe, "application/octet-stream"),
                    headers={"Content-Disposition": f'inline; filename="{p["nom_fichier"]}"'})


@app.post("/reinitialiser")
def reinitialiser():
    """Remet la démonstration à zéro entre deux rendez-vous."""
    global depot
    depot.cx.close()
    for chemin in (cfg.BASE, cfg.IMAGES, cfg.EXPORTS, cfg.DONNEES / ".releves"):
        if chemin.is_dir():
            shutil.rmtree(chemin, ignore_errors=True)
        elif chemin.exists():
            chemin.unlink()
    depot = DepotSQLite(cfg.BASE)
    amorcer(depot)
    return RedirectResponse("/?reinit=1", status_code=303)
