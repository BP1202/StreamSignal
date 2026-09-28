import pytest
from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    """Verify that root endpoint responds with 200 OK and service metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "StreamSignal Backend"
    assert data["status"] == "online"


def test_basic_health_endpoint(client: TestClient):
    """Verify that /health responds with 200 OK and healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "StreamSignal Backend" in data["app_name"]


def test_database_health_endpoint(client: TestClient):
    """Verify database health endpoint connects to PostgreSQL and verifies extensions."""
    response = client.get("/health/db")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    details = data["details"]
    assert details["connected"] is True
    assert "PostgreSQL 17" in details["version"]
    assert details["postgis_enabled"] is True
    assert details["pgvector_enabled"] is True
    assert details["all_required_extensions_enabled"] is True


def test_extension_functionality(client: TestClient):
    """Verify that PostGIS and pgvector queries execute successfully against PostgreSQL 17."""
    response = client.get("/health/extensions/verify")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "verified"
    assert "POINT" in data["postgis_result"]
    assert isinstance(data["pgvector_distance"], float)
