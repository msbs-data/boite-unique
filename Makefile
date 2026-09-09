.PHONY: help up down build restart logs test dev-backend dev-frontend clean start

start:
	./start.sh

help:
	@echo "Commandes disponibles pour La Boîte Unique :"
	@echo "  make start        - Démarre l'application en 1 clic (script start.sh)"
	@echo "  make up           - Démarre la stack complète Docker (PostgreSQL, Backend FastAPI, Frontend Next.js)"
	@echo "  make build        - Reconstruit les images Docker"
	@echo "  make down         - Arrête tous les conteneurs"
	@echo "  make logs         - Affiche les logs de la stack"
	@echo "  make test         - Exécute les tests unitaires et d'intégration du backend"
	@echo "  make dev-backend  - Lance le backend FastAPI en local (rechargement à chaud)"
	@echo "  make dev-frontend - Lance le frontend Next.js en local (pnpm dev)"

up:
	docker compose up -d

build:
	docker compose build

down:
	docker compose down

restart:
	docker compose down && docker compose up -d

logs:
	docker compose logs -f

test:
	.venv/bin/python -m pytest backend/tests -v

dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8001

dev-frontend:
	cd frontend && pnpm dev

clean:
	docker compose down -v
	rm -rf backend/__pycache__ frontend/.next
