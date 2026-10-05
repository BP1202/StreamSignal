"""
StreamSignal — Production Vertical Slice End-to-End Integration Test
Validates the complete loop from empty database to:
Citizen Submission -> PostgreSQL -> Media Processing -> SignalCase Assembly
-> Research Inbox -> Investigation -> Human Review -> Lineage Event -> Citizen Impact Status
"""

import io
from datetime import datetime, timezone
from PIL import Image
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.models.report import Report
from app.models.media import ReportMedia
from app.models.human_review import HumanReview
from app.models.evidence_lineage import EvidenceLineageEvent


def make_test_image() -> bytes:
    """Creates a valid test JPEG image in memory."""
    buf = io.BytesIO()
    img = Image.new("RGB", (120, 120), color=(30, 150, 60))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_complete_production_vertical_slice(client: TestClient):
    """
    Critical Integration Test:
    Citizen observation -> Persisted Report -> Persisted Media -> SignalCase
    -> Research Inbox -> Investigation -> Review Decision -> Lineage Event -> Citizen Impact
    """
    # 1. Citizen submits observation
    report_payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Noticeable green surface film observed near downstream storm outfall.",
        "water_appearance": "green_scum",
        "flow_condition": "stagnant",
        "odor": "musty",
        "foam_observed": True,
        "litter_observed": False,
        "dead_wildlife_observed": False,
    }
    report_res = client.post("/api/v1/reports", json=report_payload)
    assert report_res.status_code == 201, report_res.text
    report_data = report_res.json()
    report_id = report_data["id"]
    assert report_id is not None

    # Verify Report persisted in database
    db = SessionLocal()
    try:
        db_report = db.query(Report).filter(Report.id == report_id).first()
        assert db_report is not None
        assert db_report.description == report_payload["description"]
    finally:
        db.close()

    # 2. Citizen attaches photo evidence
    img_bytes = make_test_image()
    files = {"file": ("stream_sample.jpg", img_bytes, "image/jpeg")}
    media_res = client.post(f"/api/v1/reports/{report_id}/media", files=files)
    assert media_res.status_code == 201, media_res.text
    media_data = media_res.json()
    assert media_data["id"] is not None
    assert media_data["content_type"] == "image/jpeg"

    # Verify ReportMedia persisted in database
    db = SessionLocal()
    try:
        db_media = db.query(ReportMedia).filter(ReportMedia.report_id == report_id).all()
        assert len(db_media) == 1
        assert db_media[0].original_filename == "stream_sample.jpg"
    finally:
        db.close()

    # 3. Retrieve SignalCase from backend
    case_res = client.get(f"/api/v1/reports/{report_id}/evidence-case")
    assert case_res.status_code == 200, case_res.text
    case_data = case_res.json()
    assert case_data["case_id"] == report_id
    assert case_data["citizen_evidence"]["description"] == report_payload["description"]
    assert len(case_data["citizen_evidence"]["media"]) == 1
    assert case_data["evidence_quality"]["quality"] in ["COMPLETE", "PARTIAL"]
    assert case_data["evidence_quality"]["score"] > 0.0

    # 4. Research Workspace Inbox contains the newly created case
    inbox_res = client.get("/api/v1/research/evidence-cases")
    assert inbox_res.status_code == 200, inbox_res.text
    inbox_data = inbox_res.json()
    case_in_inbox = next((c for c in inbox_data["items"] if str(c["case_id"]) == str(report_id)), None)
    assert case_in_inbox is not None
    assert case_in_inbox["media_count"] == 1
    assert case_in_inbox["human_decision_status"] in ["PENDING", "AWAITING_REVIEW"]
    assert len(case_in_inbox["why_surfaced"]) > 0

    # 5. Researcher opens case for investigation
    detail_res = client.get(f"/api/v1/research/evidence-cases/{report_id}")
    assert detail_res.status_code == 200, detail_res.text
    detail_data = detail_res.json()
    assert detail_data["case_id"] == report_id
    assert detail_data["human_decision_status"] in ["PENDING", "AWAITING_REVIEW"]
    assert detail_data["triage"]["recommended_action"] in [
        "EXPERT_REVIEW",
        "FIELD_VERIFICATION",
        "REQUEST_MORE_EVIDENCE",
        "MONITOR",
    ]

    # Initial impact status is safe awaiting review
    impact_before = client.get(f"/api/v1/reports/{report_id}/impact-status")
    assert impact_before.status_code == 200
    impact_before_data = impact_before.json()
    assert "Awaiting" in impact_before_data["status_label"]
    # Ensure researcher details never leak to citizen
    assert "reviewer" not in impact_before_data
    assert "rationale" not in impact_before_data

    # 6. Researcher records review decision: REQUEST_FIELD_VERIFICATION
    review_payload = {
        "outcome": "REQUEST_FIELD_VERIFICATION",
        "rationale": "Visual cues show dense surface film requiring in-situ sensor verification.",
    }
    review_res = client.post(
        f"/api/v1/research/evidence-cases/{report_id}/reviews",
        json=review_payload,
    )
    assert review_res.status_code == 201, review_res.text
    review_data = review_res.json()
    assert review_data["outcome"] == "REQUEST_FIELD_VERIFICATION"
    assert review_data["workflow_status"] == "FIELD_VERIFICATION_REQUESTED"
    # One Health rule: evidence state tier remains E4 (or lower) and is NOT promoted to E5
    assert review_data["evidence_state_after"] != "E5_VERIFIED"

    # Verify HumanReview persisted in database
    db = SessionLocal()
    try:
        db_review = db.query(HumanReview).filter(HumanReview.report_id == report_id).first()
        assert db_review is not None
        assert db_review.outcome == "REQUEST_FIELD_VERIFICATION"


        # 7. Verify Evidence Lineage Event is persisted
        db_lineage = db.query(EvidenceLineageEvent).filter(
            EvidenceLineageEvent.signal_case_id == report_id
        ).all()
        assert len(db_lineage) >= 1
        review_lineage = next(
            (e for e in db_lineage if e.event_type == "HUMAN_REVIEW_RECORDED"),
            None,
        )
        assert review_lineage is not None
        assert review_lineage.actor_type == "RESEARCHER"
    finally:
        db.close()

    # 8. Citizen impact status updates with non-sensitive guidance
    impact_after = client.get(f"/api/v1/reports/{report_id}/impact-status")
    assert impact_after.status_code == 200
    impact_after_data = impact_after.json()
    assert impact_after_data["status"] == "FIELD_VERIFICATION_REQUESTED"
    assert "Field Verification Requested" in impact_after_data["status_label"]
    # Confidentiality check: no researcher ID, no private internal rationale
    assert "reviewer_id" not in impact_after_data
    assert "rationale" not in impact_after_data
    assert review_payload["rationale"] not in impact_after_data["description"]
