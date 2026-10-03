"""
StreamSignal — Evidence Passport Unit & Integration Tests (One Health Interoperability)
Validates the generation, separation, provenance preservation, and security boundaries
of the Evidence Passport.
"""

import io
import random
from datetime import datetime, timezone
from PIL import Image
from fastapi.testclient import TestClient


def create_test_image() -> bytes:
    """Generate in-memory test JPEG with noticeable green color."""
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(30, 170, 50))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def get_coords() -> tuple[float, float]:
    return (
        round(random.uniform(10.0, 45.0), 4),
        round(random.uniform(10.0, 45.0), 4),
    )


def test_evidence_passport_not_found(client: TestClient):
    """
    Test 1: Requesting passport for a non-existent UUID returns 404.
    """
    random_id = "00000000-0000-0000-0000-000000000000"
    res = client.get(f"/api/v1/research/evidence-cases/{random_id}/evidence-passport")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_evidence_passport_comprehensive_structure(client: TestClient):
    """
    Test 2: Requesting passport for an authentic submitted case returns
    complete structured sections with strict separation.
    """
    lat, lon = get_coords()
    now = datetime.now(timezone.utc)
    create_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Greenish water with slight unusual earthy odor observed near riverbank.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "odor": "earthy",
            "foam_observed": True,
            "litter_observed": False,
            "dead_wildlife_observed": False,
        },
    )
    assert create_res.status_code == 201
    case_id = create_res.json()["id"]

    # Upload an authentic media attachment
    img_bytes = create_test_image()
    media_res = client.post(
        f"/api/v1/reports/{case_id}/media",
        files={"file": ("stream_sample.jpg", img_bytes, "image/jpeg")},
    )
    assert media_res.status_code == 201

    # Request the Evidence Passport
    passport_res = client.get(f"/api/v1/research/evidence-cases/{case_id}/evidence-passport")
    assert passport_res.status_code == 200
    passport = passport_res.json()

    # Verify Metadata
    assert "metadata" in passport
    assert passport["metadata"]["schema_version"] == "1.0.0"
    assert "StreamSignal One Health Evidence Model" in passport["metadata"]["governance_standard"]
    assert passport["metadata"]["system_source"] == "StreamSignal Interoperability Gateway"

    # Verify Identity
    assert passport["identity"]["case_id"] == case_id
    assert passport["identity"]["report_id"] == case_id
    assert passport["identity"]["current_workflow_status"] == "AWAITING_REVIEW"
    assert passport["identity"]["current_evidence_state"] in ["E1_REPORTED", "E2_DOCUMENTED"]

    # Verify Citizen Evidence
    citizen = passport["citizen_evidence"]
    assert citizen["evidence_origin"] == "CITIZEN_REPORTED"
    assert citizen["description"] == "Greenish water with slight unusual earthy odor observed near riverbank."
    assert citizen["water_appearance"] == "green_surface_material"
    assert citizen["flow_condition"] == "stagnant"
    assert citizen["odor"] == "earthy"
    assert citizen["foam_observed"] is True

    # Verify Quality
    quality = passport["evidence_quality"]
    assert quality["completeness_score"] > 0.5
    assert len(quality["present_dimensions"]) >= 4
    assert "density" in quality["interpretation_boundary"].lower()

    # Verify Media Evidence (Safe metadata only, no raw disk path)
    media_section = passport["media_evidence"]
    assert media_section["total_media"] == 1
    media_item = media_section["items"][0]
    assert media_item["original_filename"] == "stream_sample.jpg"
    assert media_item["content_type"] == "image/jpeg"
    assert media_item["size_bytes"] > 0
    assert len(media_item["sha256_hash"]) == 64
    assert media_item["safe_reference"].startswith(f"/api/v1/reports/{case_id}/media/")
    # Ensure no disk paths leaked
    assert "C:\\" not in media_item["safe_reference"]
    assert "/tmp/" not in media_item["safe_reference"]

    # Verify Machine Assistance
    machine = passport["machine_assistance"]
    assert machine["evidence_class"] == "E3_INFERRED"
    assert "scientific_limitation" in machine
    assert "Machine vision observations indicate visible cues only" in machine["scientific_limitation"]

    # Verify Contextual Evidence
    context = passport["contextual_evidence"]
    assert "interpretation_boundary" in context
    assert "similarity, not environmental causation" in context["interpretation_boundary"]

    # Verify SignalGuard
    sg = passport["signal_guard"]
    assert "contract_version" in sg
    assert len(sg["supported_claims"]) > 0
    assert "POLLUTION_CONFIRMED" in sg["prohibited_interpretations"]
    assert "TOXICITY_CONFIRMED" in sg["prohibited_interpretations"]

    # Verify Human Decision (Awaiting Review)
    hd = passport["human_decision"]
    assert hd["review_status"] == "AWAITING_REVIEW"
    assert hd["workflow_status"] == "AWAITING_REVIEW"
    assert hd["outcome"] is None

    # Verify Lineage Audit
    lineage = passport["lineage"]
    assert lineage["total_events"] == 0
    assert len(lineage["events"]) == 0


def test_evidence_passport_reflects_human_review_and_preserves_boundaries(client: TestClient):
    """
    Test 3: Human review decision updates the passport without violating
    evidence tier boundaries (REQUEST_FIELD_VERIFICATION does not elevate to E5).
    """
    lat, lon = get_coords()
    create_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Unverified cloudiness in water channel.",
            "water_appearance": "milky_white",
        },
    )
    case_id = create_res.json()["id"]

    # Submit a human review requesting field verification
    rev_res = client.post(
        f"/api/v1/research/evidence-cases/{case_id}/reviews",
        json={
            "outcome": "REQUEST_FIELD_VERIFICATION",
            "rationale": "High turbidity reported near residential outflow; requires municipal in-situ testing.",
        },
        headers={"X-Reviewer-Id": "R-109"},
    )
    assert rev_res.status_code == 201

    # Fetch Evidence Passport
    passport_res = client.get(f"/api/v1/research/evidence-cases/{case_id}/evidence-passport")
    assert passport_res.status_code == 200
    passport = passport_res.json()

    # Workflow status must be updated
    assert passport["identity"]["current_workflow_status"] == "FIELD_VERIFICATION_REQUESTED"
    # Evidence state MUST NOT be promoted to E5_VERIFIED
    assert passport["identity"]["current_evidence_state"] != "E5_VERIFIED"

    # Human decision section
    hd = passport["human_decision"]
    assert hd["review_status"] == "REVIEWED"
    assert hd["outcome"] == "REQUEST_FIELD_VERIFICATION"
    assert hd["workflow_status"] == "FIELD_VERIFICATION_REQUESTED"
    assert hd["reviewer_id"] == "R-109"
    assert "municipal in-situ testing" in hd["rationale"]

    # Lineage must include the review event
    lineage_events = [e["event_type"] for e in passport["lineage"]["events"]]
    assert "HUMAN_REVIEW_RECORDED" in lineage_events
