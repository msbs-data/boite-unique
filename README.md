# La boîte unique — Architecture Fullstack

Application de gestion comptable : ingestion des pièces, routage par alias de messagerie, extraction Factur-X native, validation et exports vers Sage Génération Experts.

## Nouvelle Architecture

Le projet est structuré en monorepo moderne à 3 composants :

```
boite-unique/
├── backend/              # Backend FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── api/v1/       # Endpoints REST (stats, dossiers, pièces, quarantaine, exports, actions)
│   │   ├── core/         # Configuration Pydantic, base de données SQLAlchemy, sécurité & CORS
│   │   ├── models/       # Modèles SQLAlchemy (PostgreSQL)
│   │   ├── schemas/      # Schémas de validation Pydantic
│   │   └── services/     # Factur-X, routage d'emails, exports Sage, ingestion
│   ├── tests/            # Tests automatisés (28 tests unitaires & d'intégration)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/             # Frontend Next.js 16 + Tailwind CSS + shadcn/ui admin dashboard
│   ├── src/
│   │   ├── app/          # App Router Next.js (dashboard, factures, courrier, etc.)
│   │   ├── components/   # Composants UI shadcn réutilisables
│   │   └── lib/          # Client API typé (`api-client.ts`)
│   ├── Dockerfile
│   └── package.json
├── data/                 # Données persistées (fichiers entrants, pièces classées, exports)
├── docker-compose.yml    # Orchestration Docker (PostgreSQL 16, Backend, Frontend)
└── Makefile              # Commandes d'automatisation
```

---

## Démarrage rapide en 1 clic 🚀

Pour lancer l'application immédiatement avec sa base de données, son backend et son frontend pré-configurés :

### macOS & Linux
```bash
./start.sh
# ou : make start
```

### Windows
Double-cliquez simplement sur **`start.bat`** (ou lancez `.\start.bat` dans PowerShell / Invite de commandes).

Ce script se charge automatiquement de :
1. Vérifier que Docker est opérationnel.
2. Initialiser le fichier `.env` si nécessaire.
3. Démarrer les 3 conteneurs (PostgreSQL, FastAPI, Next.js).
4. Amorcer la base avec les dossiers clients, les factures Factur-X et les **photos de tickets réelles** avec simulation OCR.
5. Ouvrir automatiquement votre navigateur sur le tableau de bord.

### Accès direct aux interfaces :
- 🌐 **Dashboard principal :** [http://localhost:3000](http://localhost:3000)
- 📬 **Boîte Unique de réception :** [http://localhost:3000/dashboard/boite](http://localhost:3000/dashboard/boite)
- 📑 **Tableau des pièces (ex. Vellard) :** [http://localhost:3000/dashboard/pieces?dossier=VELLARD-TOI](http://localhost:3000/dashboard/pieces?dossier=VELLARD-TOI)
- 📚 **Documentation API Swagger :** [http://localhost:8001/docs](http://localhost:8001/docs)
- 🗄️ **Base de données PostgreSQL :** `localhost:5433` (base `cabinet_db`, utilisateur `cabinet`)

Pour arrêter l'application : `docker compose down` (ou `make down`).

---

### Option 2 : Développement local

#### 1. Backend FastAPI

```bash
# Activer l'environnement virtuel
source .venv/bin/activate
pip install -r backend/requirements.txt

# Lancer le backend
uvicorn backend.app.main:app --reload --port 8001
```

Documentation interactive accessible sur `http://localhost:8001/docs`.

#### 2. Frontend Next.js

```bash
cd frontend
pnpm install
pnpm dev
```

Interface disponible sur `http://localhost:3000`.

---

## Tests

Pour exécuter l'ensemble de la suite de tests (routage, Factur-X, Sage, endpoints d'API) :

```bash
make test
# ou : .venv/bin/python -m pytest backend/tests -v
```

---

## Ce qui est réel, ce qui est simulé

| Réel — du code de production | Simulé — remplacé en production |
|---|---|
| Routage d'un mail vers son dossier, à partir des vrais en-têtes | La reconnaissance de caractères OCR (Paperless-ngx) |
| Lecture Factur-X : le XML est extrait du PDF et lu nativement | L'extraction par modèle local LLM (Ollama) |
| Détection des doublons par empreinte SHA-256 | La relève IMAP (fichiers `.eml` simulés) |
| Mise en quarantaine des alias inconnus | |
| Recherche plein texte sur le contenu | |
| Export CSV vers Sage et règle de non-rejeu | |

---

## Endpoints principaux de l'API (`/api/v1`)

- `GET /api/v1/health` : État de l'API et de la connexion PostgreSQL.
- `GET /api/v1/stats` : Compteurs en temps réel pour les cartes du Dashboard.
- `GET /api/v1/dossiers` / `POST /api/v1/dossiers` : Gestion des dossiers clients et alias.
- `GET /api/v1/pieces` : Liste filtrable des pièces (recherche, statut, dossier).
- `GET /api/v1/pieces/{id}` : Détail d'une pièce avec données Factur-X extraites.
- `GET /api/v1/pieces/{id}/fichier` : Prévisualisation sécurisée du fichier (PDF/image).
- `POST /api/v1/pieces/{id}/valider` : Validation comptable d'une pièce (« lue »).
- `POST /api/v1/actions/recevoir` : Relève de nouveaux courriels entrants.
- `POST /api/v1/actions/deposer` : Dépôt direct de facture ou fichier `.eml`.
- `GET /api/v1/quarantaine` : Liste des pièces non routées.
- `GET /api/v1/exports/apercu` : Aperçu des écritures comptables Sage avant génération.
- `POST /api/v1/exports/generer` : Génération du fichier CSV Sage et marquage « exportée ».
