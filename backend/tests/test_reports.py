import pytest
import uuid
import time
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.core.database import SessionLocal
from app.models.report import Report


def test_create_report_success(client: TestClient):
    """Citizen submits a valid freshwater observation report."""
    payload = {
        "observed_at": "2026-09-30T10:00:00Z",
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Observed unusual green surface material near the stream edge.",
        "water_appearance": "green_surface_material",
        "odor": "none_noticed",
        "flow_condition": "flowing",
        "foam_observed": False,
        "litter_observed": False,
        "dead_wildlife_observed": False,
    }

    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert data["status"] == "SUBMITTED"
    assert data["latitude"] == pytest.approx(23.0225)
    assert data["longitude"] == pytest.approx(72.5714)
    assert data["description"] == payload["description"]
    assert data["water_appearance"] == "green_surface_material"
    assert data["odor"] == "none_noticed"
    assert data["flow_condition"] == "flowing"
    assert data["foam_observed"] is False
    assert data["litter_observed"] is False
    assert data["dead_wildlife_observed"] is False
    assert "created_at" in data
    assert "updated_at" in data


def test_create_report_minimal(client: TestClient):
    """Citizen submits report with only mandatory fields."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
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


def test_create_report_database_persistence(client: TestClient):
    """Verify report is actually persisted in the PostgreSQL database."""
    unique_desc = f"Direct DB persistence test {uuid.uuid4()}"
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 12.9716,
        "longitude": 77.5946,
        "description": unique_desc,
        "water_appearance": "murky",
    }

    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == 201
    report_id = response.json()["id"]

    # Verify directly via SQLAlchemy Session
    with SessionLocal() as db:
        db_record = db.query(Report).filter(Report.id == uuid.UUID(report_id)).first()
        assert db_record is not None
        assert db_record.description == unique_desc
        assert db_record.status == "SUBMITTED"
        assert db_record.latitude == pytest.approx(12.9716)
        assert db_record.longitude == pytest.approx(77.5946)


def test_create_report_invalid_coordinates(client: TestClient):
    """Invalid latitude or longitude must be rejected with 422 Unprocessable Entity."""
    base_payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "description": "Coordinate boundary test",
    }

    # Latitude > 90
    res1 = client.post("/api/v1/reports", json={**base_payload, "latitude": 90.1, "longitude": 0.0})
    assert res1.status_code == 422

    # Latitude < -90
    res2 = client.post("/api/v1/reports", json={**base_payload, "latitude": -90.1, "longitude": 0.0})
    assert res2.status_code == 422

    # Longitude > 180
    res3 = client.post("/api/v1/reports", json={**base_payload, "latitude": 0.0, "longitude": 180.1})
    assert res3.status_code == 422

    # Longitude < -180
    res4 = client.post("/api/v1/reports", json={**base_payload, "latitude": 0.0, "longitude": -180.1})
    assert res4.status_code == 422


def test_create_report_empty_description(client: TestClient):
    """Empty or whitespace-only descriptions must be rejected."""
    base_payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 37.7749,
        "longitude": -122.4194,
    }

    # Empty string
    res1 = client.post("/api/v1/reports", json={**base_payload, "description": ""})
    assert res1.status_code == 422

    # Whitespace only
    res2 = client.post("/api/v1/reports", json={**base_payload, "description": "     "})
    assert res2.status_code == 422


def test_create_report_description_too_long(client: TestClient):
    """Descriptions exceeding maximum length (5000 chars) must be rejected."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 37.7749,
        "longitude": -122.4194,
        "description": "A" * 5001,
    }
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == 422


def test_create_report_missing_required_fields(client: TestClient):
    """Required fields (latitude, longitude, observed_at, description) must be enforced."""
    # Missing observed_at
    res1 = client.post("/api/v1/reports", json={
        "latitude": 10.0,
        "longitude": 20.0,
        "description": "Missing observed_at",
    })
    assert res1.status_code == 422

    # Missing latitude
    res2 = client.post("/api/v1/reports", json={
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "longitude": 20.0,
        "description": "Missing latitude",
    })
    assert res2.status_code == 422

    # Missing longitude
    res3 = client.post("/api/v1/reports", json={
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 10.0,
        "description": "Missing longitude",
    })
    assert res3.status_code == 422

    # Missing description
    res4 = client.post("/api/v1/reports", json={
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 10.0,
        "longitude": 20.0,
    })
    assert res4.status_code == 422


def test_client_cannot_set_protected_fields(client: TestClient):
    """Client must not be able to supply id, status, or timestamps."""
    valid_payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 12.0,
        "longitude": 34.0,
        "description": "Attempt to supply protected fields",
    }

    # Attempt to supply status
    res1 = client.post("/api/v1/reports", json={**valid_payload, "status": "APPROVED"})
    assert res1.status_code == 422

    # Attempt to supply id
    res2 = client.post("/api/v1/reports", json={**valid_payload, "id": str(uuid.uuid4())})
    assert res2.status_code == 422

    # Attempt to supply created_at
    res3 = client.post("/api/v1/reports", json={**valid_payload, "created_at": "2020-01-01T00:00:00Z"})
    assert res3.status_code == 422

    # Attempt to supply updated_at
    res4 = client.post("/api/v1/reports", json={**valid_payload, "updated_at": "2020-01-01T00:00:00Z"})
    assert res4.status_code == 422


def test_get_report_by_id(client: TestClient):
    """Retrieve an existing report by ID."""
    create_payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 51.5074,
        "longitude": -0.1278,
        "description": "Noticeable oily sheen floating on the surface near bridge pier.",
        "water_appearance": "oily_sheen",
    }
    create_res = client.post("/api/v1/reports", json=create_payload)
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

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


def test_get_report_invalid_uuid(client: TestClient):
    """Requesting an invalid UUID format must return 422 Unprocessable Entity."""
    res = client.get("/api/v1/reports/not-a-valid-uuid")
    assert res.status_code == 422


def test_list_reports_default_pagination(client: TestClient):
    """GET /api/v1/reports returns default paginated response with metadata."""
    res = client.get("/api/v1/reports")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["limit"] == 20
    assert data["offset"] == 0
    assert isinstance(data["items"], list)
    assert data["total"] >= len(data["items"])


def test_list_reports_pagination_slicing(client: TestClient):
    """Pagination query params limit and offset correctly slice report batches."""
    # Ensure at least 4 reports exist
    for i in range(4):
        client.post("/api/v1/reports", json={
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "latitude": 10.0 + i,
            "longitude": 20.0 + i,
            "description": f"Batch pagination test report {i} {uuid.uuid4()}",
        })

    # Fetch page 1 (limit 2, offset 0)
    page1_res = client.get("/api/v1/reports?limit=2&offset=0")
    assert page1_res.status_code == 200
    page1 = page1_res.json()
    assert len(page1["items"]) == 2
    assert page1["limit"] == 2
    assert page1["offset"] == 0

    # Fetch page 2 (limit 2, offset 2)
    page2_res = client.get("/api/v1/reports?limit=2&offset=2")
    assert page2_res.status_code == 200
    page2 = page2_res.json()
    assert len(page2["items"]) == 2
    assert page2["limit"] == 2
    assert page2["offset"] == 2

    # Ensure items on page 1 and page 2 are distinct
    page1_ids = {item["id"] for item in page1["items"]}
    page2_ids = {item["id"] for item in page2["items"]}
    assert page1_ids.isdisjoint(page2_ids)


def test_list_reports_ordering(client: TestClient):
    """Reports must be returned in deterministic newest-first order (created_at DESC, id DESC)."""
    # Create two reports in sequence
    first_res = client.post("/api/v1/reports", json={
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 40.7128,
        "longitude": -74.0060,
        "description": f"Ordering test first report {uuid.uuid4()}",
    })
    assert first_res.status_code == 201
    first_id = first_res.json()["id"]

    second_res = client.post("/api/v1/reports", json={
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 40.7128,
        "longitude": -74.0060,
        "description": f"Ordering test second report {uuid.uuid4()}",
    })
    assert second_res.status_code == 201
    second_id = second_res.json()["id"]

    # List reports
    list_res = client.get("/api/v1/reports?limit=20&offset=0")
    assert list_res.status_code == 200
    items = list_res.json()["items"]

    # Locate positions
    item_ids = [item["id"] for item in items]
    assert second_id in item_ids
    assert first_id in item_ids
    assert item_ids.index(second_id) < item_ids.index(first_id)


def test_list_reports_invalid_limit(client: TestClient):
    """Limit parameter must reject 0, negative values, and values above 100."""
    # limit = 0
    res1 = client.get("/api/v1/reports?limit=0")
    assert res1.status_code == 422

    # limit = -1
    res2 = client.get("/api/v1/reports?limit=-1")
    assert res2.status_code == 422

    # limit > 100
    res3 = client.get("/api/v1/reports?limit=101")
    assert res3.status_code == 422


def test_list_reports_invalid_offset(client: TestClient):
    """Offset parameter must reject negative values."""
    res = client.get("/api/v1/reports?offset=-1")
    assert res.status_code == 422
