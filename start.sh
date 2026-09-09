#!/usr/bin/env bash
set -e

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  🚀 Démarrage de La Boîte Unique — Cabinet Comptable ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Vérification de Docker
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}❌ Erreur : Docker n'est pas installé ou introuvable dans le PATH.${NC}"
  echo -e "Veuillez installer Docker Desktop : https://www.docker.com/products/docker-desktop"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}❌ Erreur : Le démon Docker ne semble pas démarré.${NC}"
  echo -e "Veuillez lancer l'application Docker Desktop puis relancer ce script."
  exit 1
fi

# 2. Configuration .env
if [ ! -f .env ]; then
  echo -e "${YELLOW}📝 Création du fichier .env à partir de .env.example...${NC}"
  cp .env.example .env
fi

# 3. Lancement des conteneurs
echo -e "${YELLOW}📦 Démarrage des conteneurs Docker (PostgreSQL, Backend FastAPI, Frontend Next.js)...${NC}"
docker compose up -d

# 4. Attente de la disponibilité des services
echo -e "${YELLOW}⏳ Attente de l'initialisation des services...${NC}"
for i in {1..30}; do
  if curl -s http://localhost:8001/api/v1/stats >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 5. Récapitulatif et ouverture
echo ""
echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}  ✅ La Boîte Unique est prête et opérationnelle !   ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo ""
echo -e "  🌐 ${BLUE}Interface Web (Dashboard) :${NC}     http://localhost:3000"
echo -e "  📬 ${BLUE}Boîte de Réception Unique :${NC}     http://localhost:3000/dashboard/boite"
echo -e "  📑 ${BLUE}Tableau des Pièces (Vellard) :${NC}    http://localhost:3000/dashboard/pieces?dossier=VELLARD-TOI"
echo -e "  📚 ${BLUE}Documentation API (Swagger) :${NC}    http://localhost:8001/docs"
echo ""
echo -e "${YELLOW}💡 Astuce :${NC} Les photos smartphones et factures Factur-X sont déjà pré-chargées avec l'OCR !"
echo -e "Pour arrêter l'application à tout moment : ${BLUE}docker compose down${NC}"
echo ""

# Ouverture automatique dans le navigateur par défaut
if command -v open >/dev/null 2>&1; then
  open http://localhost:3000
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:3000 >/dev/null 2>&1 &
fi
