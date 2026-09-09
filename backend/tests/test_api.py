"""Tests d'intégration des endpoints FastAPI."""

from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "api_v1" in data


def test_health_check(client: TestClient):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "ok"


def test_lister_dossiers(client: TestClient):
    response = client.get("/api/v1/dossiers")
    assert response.status_code == 200
    dossiers = response.json()
    assert len(dossiers) >= 7
    codes = [d["code"] for d in dossiers]
    assert "VELLARD-TOI" in codes


def test_creer_dossier(client: TestClient):
    payload = {
        "code": "TEST-NOUV",
        "raison_sociale": "Entreprise Test Nouveau",
        "alias": "test-nouv@cabinet-demo.fr",
        "actif": True,
    }
    response = client.post("/api/v1/dossiers", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "TEST-NOUV"
    assert data["alias"] == "test-nouv@cabinet-demo.fr"


def test_stats_endpoint(client: TestClient):
    response = client.get("/api/v1/stats")
    assert response.status_code == 200
    stats = response.json()
    assert "pieces" in stats
    assert "dossiers" in stats
    assert stats["dossiers"] >= 7


def test_pieces_filtres(client: TestClient):
    response = client.get("/api/v1/pieces")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_quarantaine_endpoint(client: TestClient):
    response = client.get("/api/v1/quarantaine")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_exports_apercu(client: TestClient):
    response = client.get("/api/v1/exports/apercu")
    assert response.status_code == 200
    data = response.json()
    assert "nb_pieces" in data
    assert "equilibre" in data
