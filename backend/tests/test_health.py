import pytest
from fastapi.testclient import TestClient
from app.core.config import get_settings

settings = get_settings()


def test_root_endpoint(client: TestClient):
    """Verify root endpoint availability, status, and API directory metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == settings.APP_NAME
    assert data["title"] == settings.APP_TITLE
    assert data["version"] == settings.VERSION
    assert data["status"] == "online"
    assert data["docs_url"] == "/docs"
    assert data["api_v1_url"] == "/api/v1"
    assert data["health_check"] == "/health"
    assert data["api_v1_health"] == "/api/v1/health"


def test_basic_health_endpoint(client: TestClient):
    """Verify that root /health endpoint responds with HTTP 200 and healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert settings.APP_NAME in data["app_name"]
    assert data["environment"] == settings.ENVIRONMENT
    assert data["version"] == settings.VERSION


def test_versioned_health_endpoint(client: TestClient):
    """Verify that versioned /api/v1/health endpoint responds with HTTP 200."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app_name"] == settings.APP_NAME
    assert data["version"] == settings.VERSION


def test_openapi_documentation_available(client: TestClient):
    """Verify that OpenAPI schema and interactive documentation are accessible."""
    docs_response = client.get("/docs")
    assert docs_response.status_code == 200

    openapi_response = client.get("/openapi.json")
    assert openapi_response.status_code == 200
    schema = openapi_response.json()
    assert "openapi" in schema
    assert schema["info"]["title"] == settings.APP_TITLE
    assert schema["info"]["version"] == settings.VERSION
    assert schema["info"]["description"] == settings.DESCRIPTION

    # Check versioned routes are registered in OpenAPI
    paths = schema["paths"]
    assert "/api/v1/health" in paths or "/api/v1/health/" in paths
    assert "/api/v1/health/db" in paths
    assert "/api/v1/health/extensions/verify" in paths


def test_cors_headers_configured(client: TestClient):
    """Verify CORS configuration applies appropriately to cross-origin requests."""
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers


def test_database_health_endpoint(client: TestClient):
    """Verify database health endpoint connects to PostgreSQL 17 and validates extensions."""
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


def test_versioned_database_health_endpoint(client: TestClient):
    """Verify versioned /api/v1/health/db route functions identically."""
    response = client.get("/api/v1/health/db")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["details"]["connected"] is True


def test_extension_functionality(client: TestClient):
    """Verify that PostGIS and pgvector queries execute successfully against PostgreSQL 17."""
    response = client.get("/health/extensions/verify")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "verified"
    assert "POINT" in data["postgis_result"]
    assert isinstance(data["pgvector_distance"], float)


def test_versioned_extension_functionality(client: TestClient):
    """Verify that versioned /api/v1/health/extensions/verify route executes successfully."""
    response = client.get("/api/v1/health/extensions/verify")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "verified"
    assert "POINT" in data["postgis_result"]
    assert isinstance(data["pgvector_distance"], float)
