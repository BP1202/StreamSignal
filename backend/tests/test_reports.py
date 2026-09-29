import pytest
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient


def test_create_report_success(client: TestClient):
    """Citizen submits a valid freshwater observation report."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 45.5152,
        "longitude": -122.6784,
        "description": "Green algae-like film observed near the urban stream bank with a slight sulfur odor.",
        "water_appearance": "green_film",
        "odor": "sulfur",
        "flow_condition": "stagnant",
        "foam_observed": True,
        "litter_observed": False,
        "dead_wildlife_observed": False,
    }

    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert data["status"] == "SUBMITTED"
    assert data["latitude"] == pytest.approx(45.5152)
    assert data["longitude"] == pytest.approx(-122.6784)
    assert data["description"] == payload["description"]
    assert data["water_appearance"] == "green_film"
    assert data["odor"] == "sulfur"
    assert data["flow_condition"] == "stagnant"
    assert data["foam_observed"] is True
    assert data["litter_observed"] is False
    assert data["dead_wildlife_observed"] is False
    assert "created_at" in data
    assert "updated_at" in data


def test_create_report_minimal(client: TestClient):
    """Citizen submits report with only mandatory fields."""
    payload = {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "description": "Cloudy water with unusual turbidity in local drainage channel.",
    }

    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["status"] == "SUBMITTED"
    assert data["foam_observed"] is False
    assert data["litter_observed"] is False
    assert data["dead_wildlife_observed"] is False
    assert data["water_appearance"] is None
    assert data["odor"] is None


def test_create_report_invalid_coordinates(client: TestClient):
    """Invalid latitude or longitude must return 422 Unprocessable Entity."""
    # Invalid latitude > 90
    bad_lat = {
        "latitude": 105.0,
        "longitude": 0.0,
        "description": "Out of range latitude",
    }
    res1 = client.post("/api/v1/reports", json=bad_lat)
    assert res1.status_code == 422

    # Invalid longitude < -180
    bad_lon = {
        "latitude": 0.0,
        "longitude": -195.0,
        "description": "Out of range longitude",
    }
    res2 = client.post("/api/v1/reports", json=bad_lon)
    assert res2.status_code == 422


def test_create_report_missing_description(client: TestClient):
    """Description cannot be empty or whitespace."""
    payload = {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "description": "   ",
    }
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == 422


def test_get_report_by_id(client: TestClient):
    """Retrieve an existing report by ID."""
    # Create report first
    create_payload = {
        "latitude": 51.5074,
        "longitude": -0.1278,
        "description": "Noticeable oily sheen floating on the surface near bridge pier.",
        "water_appearance": "oily_sheen",
    }
    create_res = client.post("/api/v1/reports", json=create_payload)
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    # Fetch report
    get_res = client.get(f"/api/v1/reports/{created_id}")
    assert get_res.status_code == 200
    report_data = get_res.json()
    assert report_data["id"] == created_id
    assert report_data["description"] == create_payload["description"]
    assert report_data["status"] == "SUBMITTED"


def test_get_report_not_found(client: TestClient):
    """Retrieving a non-existent report ID returns 404."""
    random_uuid = str(uuid.uuid4())
    res = client.get(f"/api/v1/reports/{random_uuid}")
    assert res.status_code == 404
    assert f"Report with id '{random_uuid}' not found" in res.json()["detail"]
