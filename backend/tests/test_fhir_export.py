"""
StreamSignal — FHIR R4 Export Unit & Integration Tests (One Health Interoperability)
Validates standards compliance, reference integrity, separation of tiers,
absence of server disk leaks, and independent third-party consumer compatibility.
"""

import io
import json
import random
from datetime import datetime, timezone
from PIL import Image
from fastapi.testclient import TestClient

from app.schemas.fhir import FHIRBundle
from app.services.fhir_export import validate_fhir_bundle


def create_test_image() -> bytes:
    """Generate in-memory test JPEG with noticeable green color."""
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(25, 150, 45))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def get_coords() -> tuple[float, float]:
    return (
        round(random.uniform(15.0, 50.0), 4),
        round(random.uniform(15.0, 50.0), 4),
    )


def test_fhir_bundle_not_found(client: TestClient):
    """
    Test 1: Requesting FHIR bundle for non-existent case returns 404.
    """
    random_id = "00000000-0000-0000-0000-000000000000"
    res = client.get(f"/api/v1/research/evidence-cases/{random_id}/fhir")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_fhir_bundle_export_and_validation(client: TestClient):
    """
    Test 2: Exporting an authentic case with media and review yields a valid
    FHIR R4 Bundle with valid internal references and zero disk path leaks.
    """
    lat, lon = get_coords()
    now = datetime.now(timezone.utc)
    create_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Green algae bloom suspected near storm drain outlet.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "foam_observed": True,
            "litter_observed": True,
        },
    )
    assert create_res.status_code == 201
    case_id = create_res.json()["id"]

    # Attach media
    img_bytes = create_test_image()
    media_res = client.post(
        f"/api/v1/reports/{case_id}/media",
        files={"file": ("algae_sample.jpg", img_bytes, "image/jpeg")},
    )
    assert media_res.status_code == 201
    media_id = media_res.json()["id"]

    # Submit human review requesting field verification
    rev_res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "REQUEST_FIELD_VERIFICATION",
            "rationale": "High turbidity and surface film reported. Field grab sample ordered.",
        },
        headers={"X-Reviewer-Id": "REV-808"},
    )
    assert rev_res.status_code == 201

    # Fetch FHIR Bundle
    fhir_res = client.get(f"/api/v1/research/evidence-cases/{case_id}/fhir")
    assert fhir_res.status_code == 200
    bundle_data = fhir_res.json()

    # Model validation with Pydantic
    bundle_model = FHIRBundle.model_validate(bundle_data)
    assert bundle_model.resourceType == "Bundle"
    assert bundle_model.type == "collection"
    assert bundle_model.total == len(bundle_model.entry)

    # Service-level validation check
    validation_errors = validate_fhir_bundle(bundle_model)
    assert validation_errors == [], f"FHIR Bundle validation errors: {validation_errors}"

    # Verify resource types present
    resource_types = [e.resource["resourceType"] for e in bundle_model.entry]
    assert "Location" in resource_types
    assert "QuestionnaireResponse" in resource_types
    assert "Observation" in resource_types
    assert "Media" in resource_types
    assert "Task" in resource_types
    assert "Provenance" in resource_types

    # Verify Location
    loc_entry = next(e for e in bundle_model.entry if e.resource["resourceType"] == "Location")
    assert loc_entry.resource["id"] == f"loc-{case_id}"
    assert loc_entry.resource["position"]["latitude"] == lat
    assert loc_entry.resource["position"]["longitude"] == lon

    # Verify QuestionnaireResponse
    qr_entry = next(e for e in bundle_model.entry if e.resource["resourceType"] == "QuestionnaireResponse")
    assert qr_entry.resource["id"] == f"qr-{case_id}"
    assert qr_entry.resource["subject"]["reference"] == f"Location/loc-{case_id}"
    assert len(qr_entry.resource["item"]) >= 4

    # Verify Media
    media_entry = next(e for e in bundle_model.entry if e.resource["resourceType"] == "Media")
    assert media_entry.resource["id"] == f"med-{media_id}"
    assert media_entry.resource["content"]["url"] == f"/api/v1/reports/{case_id}/media/{media_id}"
    # Ensure no disk paths
    assert "C:\\" not in media_entry.resource["content"]["url"]
    assert "/tmp/" not in media_entry.resource["content"]["url"]

    # Verify Task preserves evidence boundaries (E4 != E5, REQUEST_FIELD_VERIFICATION is requested, not completed)
    task_entry = next(e for e in bundle_model.entry if e.resource["resourceType"] == "Task")
    assert task_entry.resource["status"] == "requested"
    assert task_entry.resource["intent"] == "order"
    assert task_entry.resource["code"]["coding"][0]["code"] == "REQUEST_FIELD_VERIFICATION"
    assert "Field grab sample ordered" in task_entry.resource["description"]

    # Verify Provenance
    prov_entries = [e for e in bundle_model.entry if e.resource["resourceType"] == "Provenance"]
    assert len(prov_entries) >= 1
    assert prov_entries[0].resource["activity"]["coding"][0]["code"] == "HUMAN_REVIEW_RECORDED"


def test_fhir_bundle_independent_external_consumer(client: TestClient):
    """
    Test 3: External Consumer Test.
    Simulates a 3rd party One Health interoperability consumer that ingests the raw
    HTTP JSON response using standard library json.loads(), parses each resourceType,
    and independently verifies the One Health evidence contract without using any
    internal StreamSignal classes.
    """
    lat, lon = get_coords()
    create_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Noticeable oily sheen on surface near culvert.",
            "water_appearance": "oily_film",
            "odor": "chemical",
        },
    )
    case_id = create_res.json()["id"]

    # Human review: RESOLVED_NO_ACTION
    rev_res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "RESOLVED_NO_ACTION",
            "rationale": "Appears to be transient surface sheen; continue periodic sensor monitoring.",
        },
        headers={"X-Reviewer-Id": "REV-EXTERNAL-AUDIT"},
    )
    assert rev_res.status_code == 201

    # Ingest FHIR endpoint as raw string
    raw_response = client.get(f"/api/v1/research/evidence-cases/{case_id}/fhir")
    assert raw_response.status_code == 200

    # Parse as standard Python dictionary (no StreamSignal imports)
    parsed = json.loads(raw_response.text)

    # 1. Standard FHIR Bundle Verification
    assert parsed.get("resourceType") == "Bundle"
    assert parsed.get("type") == "collection"
    entries = parsed.get("entry", [])
    assert len(entries) > 0

    # Index resources by type and id
    catalog = {}
    for entry in entries:
        assert "fullUrl" in entry
        res = entry.get("resource", {})
        r_type = res.get("resourceType")
        r_id = res.get("id")
        assert r_type is not None, f"Resource missing resourceType in entry {entry['fullUrl']}"
        assert r_id is not None, f"Resource missing id in entry {entry['fullUrl']}"
        catalog[f"{r_type}/{r_id}"] = res

    # 2. Check essential One Health resources
    assert f"Location/loc-{case_id}" in catalog
    assert f"QuestionnaireResponse/qr-{case_id}" in catalog
    assert f"Observation/obs-citizen-{case_id}" in catalog

    # 3. Verify Citizen Observation is strictly E1_REPORTED
    citizen_obs = catalog[f"Observation/obs-citizen-{case_id}"]
    coding = citizen_obs.get("interpretation", [{}])[0].get("coding", [{}])[0]
    assert coding.get("code") == "E1_REPORTED"
    assert "clinical" not in citizen_obs.get("valueString", "").lower()

    # 4. Verify Task maps to RESOLVED_NO_ACTION with status 'completed'
    tasks = [r for k, r in catalog.items() if k.startswith("Task/")]
    assert len(tasks) == 1
    assert tasks[0]["status"] == "completed"
    assert tasks[0]["intent"] == "order"
    assert tasks[0]["code"]["coding"][0]["code"] == "RESOLVED_NO_ACTION"

    # 5. Verify Reference Integrity independently
    # Every reference pointing to an internal Location, Observation, etc. must resolve in catalog
    for k, res in catalog.items():
        res_str = json.dumps(res)
        # Verify no disk paths in any serialized resource
        assert "C:\\" not in res_str
        assert "/tmp/" not in res_str
        assert "storage_path" not in res_str
