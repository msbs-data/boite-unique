@echo off
chcp 65001 > nul
title La Boite Unique - Demarrage 1-Clic

echo ======================================================
echo   Demarrage de La Boite Unique - Cabinet Comptable
echo ======================================================
echo.

REM Verification de Docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERREUR] Docker n'est pas installe ou introuvable.
    echo Veuillez installer Docker Desktop : https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Configuration .env
if not exist .env (
    echo [INFO] Creation du fichier .env depuis .env.example...
    copy .env.example .env > nul
)

REM Demarrage de la stack
echo [INFO] Demarrage des conteneurs Docker...
docker compose up -d

echo.
echo ======================================================
echo   La Boite Unique est prete !
echo ======================================================
echo.
echo   Interface Web : http://localhost:3000
echo   Boite de reception : http://localhost:3000/dashboard/boite
echo   Tableau des pieces : http://localhost:3000/dashboard/pieces?dossier=VELLARD-TOI
echo   Documentation API : http://localhost:8001/docs
echo.
echo Ouverture automatique dans le navigateur...
start http://localhost:3000
