import io
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from PIL import Image
from fastapi.testclient import TestClient


from app.core.database import SessionLocal
from app.models.report import Report


def create_green_jpeg() -> bytes:
    """Generate in-memory test JPEG with noticeable green color."""
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(25, 165, 45))
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ----------------------------------------------------------------------
# 1. API Basics & Error Handling
# ----------------------------------------------------------------------

def test_triage_not_found(client: TestClient):
    """Test 1: Requesting triage for non-existent report returns 404."""
    random_uuid = str(uuid.uuid4())
    res = client.get(f"/api/v1/reports/{random_uuid}/triage")
    assert res.status_code == 404
    assert f"Report with id '{random_uuid}' not found" in res.json()["detail"]


def test_triage_invalid_uuid(client: TestClient):
    """Test 2: Malformed UUID returns 422 Unprocessable Entity."""
    res = client.get("/api/v1/reports/not-a-valid-uuid/triage")
    assert res.status_code == 422


# ----------------------------------------------------------------------
# 2. Decision Rules & Action Recommendations
# ----------------------------------------------------------------------

def test_triage_insufficient_evidence_requests_more_evidence(client: TestClient):
    """
    Test 3: Report with missing core evidence (e.g. whitespace-only description in DB)
    evaluates to INSUFFICIENT quality and recommends REQUEST_MORE_EVIDENCE.
    """
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)
    db = SessionLocal()
    try:
        report = Report(
            id=uuid.uuid4(),
            observed_at=now,
            latitude=61.1000,
            longitude=21.1000,
            description="   ",  # whitespace only -> missing description dimension in assess_evidence_quality
            status="SUBMITTED",
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        report_id = str(report.id)
    finally:
        db.close()

    triage_res = client.get(f"/api/v1/reports/{report_id}/triage")
    assert triage_res.status_code == 200
    data = triage_res.json()

    assert data["report_id"] == report_id
    assert data["recommended_action"] == "REQUEST_MORE_EVIDENCE"
    assert "INSUFFICIENT_CORE_EVIDENCE" in data["reason_codes"]
    assert data["evidence_summary"]["quality"] == "INSUFFICIENT"
    assert any("core" in exp.lower() for exp in data["explanation"])


def test_triage_partial_evidence_requests_more_evidence(client: TestClient):
    """
    Test 4: Report with core evidence documented but missing contextual fields
    evaluates to PARTIAL quality with no visual/historical triggers,
    recommending REQUEST_MORE_EVIDENCE.
    """
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)
    res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": 62.2000,
            "longitude": 22.2000,
            "description": "Observed water discoloration along stream edge.",
            "water_appearance": None,
            "flow_condition": None,
            "odor": None,
        },
    )
    assert res.status_code == 201
    report_id = res.json()["id"]

    triage_res = client.get(f"/api/v1/reports/{report_id}/triage")
    assert triage_res.status_code == 200
    data = triage_res.json()

    assert data["report_id"] == report_id
    assert data["recommended_action"] == "REQUEST_MORE_EVIDENCE"
    assert "MISSING_CONTEXTUAL_EVIDENCE" in data["reason_codes"]
    assert data["evidence_summary"]["quality"] == "PARTIAL"
    assert any("contextual" in exp.lower() for exp in data["explanation"])


def test_triage_complete_evidence_with_no_triggers_recommends_monitor(client: TestClient):
    """
    Test 5: Fully documented report (COMPLETE quality) with 0 media and
    no historical matches recommends MONITOR.
    """
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)
    res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": 63.3000,
            "longitude": 23.3000,
            "description": "Completely documented observation of stream conditions.",
            "water_appearance": "clear",
            "flow_condition": "normal_flow",
            "odor": "none",
            "foam_observed": False,
            "litter_observed": False,
            "dead_wildlife_observed": False,
        },
    )
    assert res.status_code == 201
    report_id = res.json()["id"]

    triage_res = client.get(f"/api/v1/reports/{report_id}/triage")
    assert triage_res.status_code == 200
    data = triage_res.json()

    assert data["report_id"] == report_id
    assert data["recommended_action"] == "MONITOR"
    assert "NO_ACTIONABLE_GAP_IDENTIFIED" in data["reason_codes"]
    assert data["evidence_summary"]["quality"] == "COMPLETE"
    assert data["evidence_summary"]["media_count"] == 0
    assert data["evidence_summary"]["historical_match_count"] == 0
    assert any("monitor" in exp.lower() for exp in data["explanation"])


def test_triage_repeated_historical_context_recommends_expert_review(client: TestClient):
    """
    Test 6: Report with >= 2 similar historical reports in Pattern Echo
    recommends EXPERT_REVIEW due to recurring observations.
    """
    base_lat = 64.4000
    base_lon = 24.4000
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Historical report 1 (4 days earlier)
    h1 = client.post(
        "/api/v1/reports",
        json={
            "observed_at": (now - timedelta(days=4)).isoformat(),
            "latitude": base_lat + 0.001,
            "longitude": base_lon,
            "description": "Historical observation 1 of green water.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
        },
    )
    assert h1.status_code == 201

    # 2. Historical report 2 (8 days earlier)
    h2 = client.post(
        "/api/v1/reports",
        json={
            "observed_at": (now - timedelta(days=8)).isoformat(),
            "latitude": base_lat + 0.002,
            "longitude": base_lon,
            "description": "Historical observation 2 of green water.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
        },
    )
    assert h2.status_code == 201

    # 3. Current report (now)
    cur = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Current observation with same green water and stagnant flow.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "odor": "musty_earthy",
        },
    )
    assert cur.status_code == 201
    report_id = cur.json()["id"]

    triage_res = client.get(f"/api/v1/reports/{report_id}/triage")
    assert triage_res.status_code == 200
    data = triage_res.json()

    assert data["report_id"] == report_id
    assert data["recommended_action"] == "EXPERT_REVIEW"
    assert "REPEATED_HISTORICAL_CONTEXT" in data["reason_codes"]
    assert "HUMAN_VERIFICATION_REQUIRED" in data["reason_codes"]
    assert data["evidence_summary"]["historical_match_count"] >= 2
    assert any("historical" in exp.lower() for exp in data["explanation"])


def test_triage_visual_evidence_recommends_expert_review(client: TestClient):
    """
    Test 7: Report with structured visual observations from media but unverified
    by human expert recommends EXPERT_REVIEW.
    """
    base_lat = 65.5000
    base_lon = 25.5000
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)

    cur = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Report with attached green visual evidence.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "odor": "musty_earthy",
        },
    )
    assert cur.status_code == 201
    report_id = cur.json()["id"]

    # Upload visual media
    green_bytes = create_green_jpeg()
    upload = client.post(
        f"/api/v1/reports/{report_id}/media",
        files={"file": ("visual_sample.jpg", green_bytes, "image/jpeg")},
    )
    assert upload.status_code == 201

    triage_res = client.get(f"/api/v1/reports/{report_id}/triage")
    assert triage_res.status_code == 200
    data = triage_res.json()

    assert data["report_id"] == report_id
    assert data["recommended_action"] == "EXPERT_REVIEW"
    assert "VISUAL_EVIDENCE_REQUIRES_REVIEW" in data["reason_codes"]
    assert "HUMAN_VERIFICATION_REQUIRED" in data["reason_codes"]
    assert data["evidence_summary"]["media_count"] >= 1
    assert data["evidence_summary"]["visual_observation_count"] >= 1
    assert any("visual" in exp.lower() for exp in data["explanation"])


# ----------------------------------------------------------------------
# 3. Determinism, Safety & Shielding
# ----------------------------------------------------------------------

def test_triage_determinism_and_repeated_calls(client: TestClient):
    """
    Test 8: Repeated calls produce identical recommended_action, reason_codes,
    evidence summary, and explanations.
    """
    base_lat = 66.6000
    base_lon = 26.6000
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)

    cur = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Deterministic triage test report.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "odor": "musty_earthy",
        },
    )
    report_id = cur.json()["id"]

    res1 = client.get(f"/api/v1/reports/{report_id}/triage").json()
    res2 = client.get(f"/api/v1/reports/{report_id}/triage").json()

    assert res1 == res2
    assert res1["recommended_action"] == res2["recommended_action"]
    assert res1["reason_codes"] == res2["reason_codes"]
    assert res1["explanation"] == res2["explanation"]


def test_triage_scientific_safety_boundaries(client: TestClient):
    """
    Test 9: Verify triage output contains zero diagnostic claims, no pollution declarations,
    no disease risk, and no fake numerical risk/probability scores.
    """
    base_lat = 67.7000
    base_lon = 27.7000
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)

    cur = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Safety boundaries check report.",
        },
    )
    report_id = cur.json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/triage")
    assert res.status_code == 200
    data = res.json()

    # Limitations check
    assert "limitations" in data
    assert any("evidence handling only" in lim.lower() for lim in data["limitations"])
    assert any("does not establish environmental cause" in lim.lower() for lim in data["limitations"])

    # Prohibited claims check on full response
    text_lower = res.text.lower()
    prohibited_terms = [
        "pollution confirmed",
        "water is toxic",
        "contamination confirmed",
        "health risk confirmed",
        "cause confirmed",
        "algae bloom confirmed",
        "disease risk",
        "risk_score",
        "probability:",
        "confidence:",
    ]
    for term in prohibited_terms:
        assert term not in text_lower, f"Prohibited diagnostic or probabilistic term found: '{term}'"


def test_triage_no_storage_paths_or_secrets_exposed(client: TestClient):
    """
    Test 10: Ensure internal storage keys, paths, and secrets are not leaked.
    """
    base_lat = 68.8000
    base_lon = 28.8000
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)

    cur = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Security shielding test report.",
        },
    )
    report_id = cur.json()["id"]

    # Upload media
    green_bytes = create_green_jpeg()
    client.post(
        f"/api/v1/reports/{report_id}/media",
        files={"file": ("sec_sample.jpg", green_bytes, "image/jpeg")},
    )

    res = client.get(f"/api/v1/reports/{report_id}/triage")
    assert res.status_code == 200
    raw_text = res.text.lower()

    assert "storage_key" not in raw_text
    assert "media_storage" not in raw_text
    assert "c:\\" not in raw_text
    assert "/var/" not in raw_text
