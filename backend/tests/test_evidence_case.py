import io
import uuid
from datetime import datetime, timezone
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.core.database import SessionLocal


@pytest.fixture
def sample_report_id(client: TestClient) -> str:
    """Create a standard citizen observation report."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Observed unusual surface discoloration along urban canal segment.",
        "water_appearance": "green_surface_material",
        "flow_condition": None,
        "odor": None,
        "foam_observed": True,
        "litter_observed": False,
        "dead_wildlife_observed": False,
    }
    res = client.post("/api/v1/reports", json=payload)
    assert res.status_code == 201
    return res.json()["id"]


def create_test_jpeg_bytes() -> bytes:
    """Generate in-memory test JPEG bytes."""
    buf = io.BytesIO()
    img = Image.new("RGB", (60, 60), color=(0, 128, 0))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_get_evidence_case_success(client: TestClient, sample_report_id: str):
    """
    Test 1: Case for existing report returns structured Evidence Case
    with separated citizen evidence, evidence quality, machine assistance,
    contextual evidence, human decision, and provenance.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-case")
    assert res.status_code == 200
    data = res.json()

    # Core Identifiers
    assert data["report_id"] == sample_report_id
    assert data["case_id"] == sample_report_id  # Stable, deterministic case ID
    assert data["status"] == "pending_review"
    assert "created_at" in data

    # 1. Citizen Evidence Section
    cit_ev = data["citizen_evidence"]
    assert cit_ev["description"] == "Observed unusual surface discoloration along urban canal segment."
    assert cit_ev["location"]["latitude"] == 23.0225
    assert cit_ev["location"]["longitude"] == 72.5714
    assert cit_ev["water_appearance"] == "green_surface_material"
    assert cit_ev["flow_condition"] is None
    assert cit_ev["odor"] is None
    assert cit_ev["foam_observed"] is True
    assert cit_ev["litter_observed"] is False
    assert cit_ev["dead_wildlife_observed"] is False
    assert cit_ev["media"] == []

    # 2. Evidence Quality Section
    eq = data["evidence_quality"]
    assert eq["quality"] in ["COMPLETE", "PARTIAL", "INSUFFICIENT"]
    assert "score" in eq
    assert "present" in eq
    assert "missing" in eq
    assert "recommendations" in eq

    # 3. Machine Assistance Section (honestly unpopulated in Issue 6)
    ma = data["machine_assistance"]
    assert ma["status"] == "not_available"
    assert ma["items"] == []

    # 4. Contextual Evidence Section (honestly unpopulated in Issue 6)
    ce = data["contextual_evidence"]
    assert ce["status"] == "not_available"
    assert ce["items"] == []

    # 5. Human Decision Section (pending expert review)
    hd = data["human_decision"]
    assert hd["status"] == "pending"
    assert hd["decision"] is None
    assert hd["reviewer"] is None
    assert hd["notes"] is None

    # 6. Provenance Section
    prov = data["provenance"]
    assert prov["source"] == "streamsignal"
    assert "generated_at" in prov
    assert "citizen_report" in prov["components"]
    assert "evidence_quality" in prov["components"]


def test_evidence_case_includes_media_evidence(client: TestClient, sample_report_id: str):
    """
    Test 2: Case includes attached visual media evidence metadata
    without exposing internal server filesystem paths.
    """
    # Upload media to the report
    img_bytes = create_test_jpeg_bytes()
    upload_res = client.post(
        f"/api/v1/reports/{sample_report_id}/media",
        files={"file": ("canal_green.jpg", img_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    media_data = upload_res.json()

    # Fetch Evidence Case
    case_res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-case")
    assert case_res.status_code == 200
    case_data = case_res.json()

    media_list = case_data["citizen_evidence"]["media"]
    assert len(media_list) >= 1

    matched = [m for m in media_list if m["id"] == media_data["id"]]
    assert len(matched) == 1
    media_item = matched[0]
    assert media_item["original_filename"] == "canal_green.jpg"
    assert media_item["content_type"] == "image/jpeg"
    assert media_item["size_bytes"] == len(img_bytes)
    assert media_item["sha256"] == media_data["sha256"]

    # Security check: ensure no absolute path or internal storage root is exposed
    case_text = case_res.text.lower()
    assert "storage_key" not in case_text
    assert "c:\\" not in case_text
    assert "media_storage" not in case_text
    assert "/var/" not in case_text


def test_evidence_case_reflects_interview_updates(client: TestClient, sample_report_id: str):
    """
    Test 3: Case reflects updated citizen evidence and recalculated quality
    after submitting follow-up interview answers.
    """
    # 1. Before interview: flow_condition is None
    initial_case = client.get(f"/api/v1/reports/{sample_report_id}/evidence-case").json()
    assert initial_case["citizen_evidence"]["flow_condition"] is None

    # 2. Citizen answers flow_condition via Issue 5 endpoint
    answer_res = client.post(
        f"/api/v1/reports/{sample_report_id}/evidence-interview/answers",
        json={"answers": [{"question_id": "flow_condition", "value": "stagnant"}]},
    )
    assert answer_res.status_code == 200

    # 3. Evidence Case now reflects flow_condition == "stagnant"
    updated_case = client.get(f"/api/v1/reports/{sample_report_id}/evidence-case").json()
    assert updated_case["citizen_evidence"]["flow_condition"] == "stagnant"
    assert "flow_condition" in updated_case["evidence_quality"]["present"]


def test_evidence_case_not_found(client: TestClient):
    """Test 4: Requesting case for non-existent report returns 404."""
    random_uuid = str(uuid.uuid4())
    res = client.get(f"/api/v1/reports/{random_uuid}/evidence-case")
    assert res.status_code == 404
    assert f"Report with id '{random_uuid}' not found" in res.json()["detail"]


def test_evidence_case_invalid_uuid(client: TestClient):
    """Test 5: Malformed UUID returns 422 Unprocessable Entity."""
    res = client.get("/api/v1/reports/not-a-valid-uuid/evidence-case")
    assert res.status_code == 422


def test_no_fabricated_scientific_or_ai_claims(client: TestClient, sample_report_id: str):
    """
    Test 6: Verify evidence case contains no fabricated AI findings,
    pollution declarations, or premature human decisions.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-case")
    assert res.status_code == 200
    data = res.json()

    assert data["machine_assistance"]["status"] == "not_available"
    assert data["machine_assistance"]["items"] == []
    assert data["contextual_evidence"]["status"] == "not_available"
    assert data["contextual_evidence"]["items"] == []
    assert data["human_decision"]["status"] == "pending"
    assert data["human_decision"]["decision"] is None

    text_lower = res.text.lower()
    prohibited_claims = [
        "water is polluted",
        "water is toxic",
        "algae bloom detected",
        "this will cause disease",
        "contamination confirmed",
        "environmental cause identified",
    ]
    for claim in prohibited_claims:
        assert claim not in text_lower, f"Prohibited claim found: '{claim}'"


def test_deterministic_case_id(client: TestClient, sample_report_id: str):
    """
    Test 7: Calling the endpoint multiple times for the same report
    returns identical, deterministic case IDs (matching report_id).
    """
    res1 = client.get(f"/api/v1/reports/{sample_report_id}/evidence-case").json()
    res2 = client.get(f"/api/v1/reports/{sample_report_id}/evidence-case").json()

    assert res1["case_id"] == res2["case_id"]
    assert res1["case_id"] == sample_report_id
