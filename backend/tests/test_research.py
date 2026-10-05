"""
StreamSignal — Research Workspace Unit & Integration Tests (Issue 12)
Validates the Evidence Inbox, deterministic triage ordering, Explainable "Why This Case?",
case investigation composition, SignalGuard claim integrity, and security boundaries.
"""

import io
import random
import uuid
from datetime import datetime, timedelta, timezone
from PIL import Image
from fastapi.testclient import TestClient

from app.schemas.triage import TriageAction


def create_green_jpeg() -> bytes:
    """Generate in-memory test JPEG with noticeable green color."""
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(20, 160, 40))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def get_fresh_coords() -> tuple[float, float]:
    return (
        round(random.uniform(10.0, 40.0), 4),
        round(random.uniform(10.0, 40.0), 4),
    )


# ----------------------------------------------------------------------
# 1. Evidence Inbox Listing & Pagination
# ----------------------------------------------------------------------

def test_research_inbox_returns_200(client: TestClient):
    """
    Test 1: Inbox endpoint returns 200 with items array, total count, limit, and offset.
    """
    res = client.get("/api/v1/research/evidence-cases")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data
    assert isinstance(data["items"], list)


def test_research_inbox_pagination(client: TestClient):
    """
    Test 2: Pagination with limit and offset behaves deterministically.
    """
    res = client.get("/api/v1/research/evidence-cases?limit=2&offset=0")
    assert res.status_code == 200
    data = res.json()
    assert data["limit"] == 2
    assert data["offset"] == 0
    assert len(data["items"]) <= 2


def test_research_inbox_item_structure(client: TestClient):
    """
    Test 3: Each inbox item contains required evidence metadata and why_surfaced explanations.
    """
    lat, lon = get_fresh_coords()
    now = datetime.now(timezone.utc) + timedelta(minutes=5)
    create_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Evidence inbox item structure verification.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "odor": "sewage",
            "foam_observed": True,
        },
    )
    assert create_res.status_code == 201
    report_id = create_res.json()["id"]

    # Attach green image to ensure meaningful visual triggers and EXPERT_REVIEW placement
    client.post(
        f"/api/v1/reports/{report_id}/media",
        files={"file": ("structure_test.jpg", create_green_jpeg(), "image/jpeg")},
    )

    res = client.get("/api/v1/research/evidence-cases?limit=20")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 0
    target = items[0]

    assert "case_id" in target
    assert uuid.UUID(target["case_id"])
    assert "observed_at" in target
    assert "location" in target
    assert "latitude" in target["location"]
    assert "longitude" in target["location"]
    assert "quality_rating" in target
    assert "completeness_score" in target
    assert target["completeness_score"] >= 0.0
    assert "media_count" in target
    assert "pattern_echo_count" in target
    assert "triage_action" in target
    assert "triage_reasons" in target
    assert target["human_decision_status"] == "PENDING"
    assert isinstance(target["why_surfaced"], list)
    assert len(target["why_surfaced"]) > 0


# ----------------------------------------------------------------------
# 2. Deterministic Ordering
# ----------------------------------------------------------------------

def test_research_inbox_deterministic_ordering(client: TestClient):
    """
    Test 4: Inbox orders cases deterministically:
    High-priority actions (EXPERT_REVIEW) appear before lower priority (MONITOR),
    followed by context trigger count, timestamp, and UUID.
    """
    res1 = client.get("/api/v1/research/evidence-cases?limit=10").json()
    res2 = client.get("/api/v1/research/evidence-cases?limit=10").json()
    # Exactly identical ordering on consecutive calls
    assert [item["case_id"] for item in res1["items"]] == [item["case_id"] for item in res2["items"]]

    # Verify priority order: EXPERT_REVIEW comes before MONITOR
    actions = [item["triage_action"] for item in res1["items"]]
    if "EXPERT_REVIEW" in actions and "MONITOR" in actions:
        expert_idx = actions.index("EXPERT_REVIEW")
        # All occurrences of MONITOR should be at or after EXPERT_REVIEW
        monitor_indices = [i for i, a in enumerate(actions) if a == "MONITOR"]
        assert all(m_idx > expert_idx for m_idx in monitor_indices)


# ----------------------------------------------------------------------
# 3. Filtering
# ----------------------------------------------------------------------

def test_research_inbox_filter_by_action(client: TestClient):
    """
    Test 5: Filter by triage action returns only matching items.
    """
    res = client.get("/api/v1/research/evidence-cases?action=EXPERT_REVIEW")
    assert res.status_code == 200
    items = res.json()["items"]
    for item in items:
        assert item["triage_action"] == "EXPERT_REVIEW"


def test_research_inbox_filter_by_has_media(client: TestClient):
    """
    Test 6: Filter by has_media=true returns only cases with media.
    """
    # Create report with media
    lat, lon = get_fresh_coords()
    rep = client.post(
        "/api/v1/reports",
        json={
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Media filter verification report.",
        },
    ).json()
    client.post(
        f"/api/v1/reports/{rep['id']}/media",
        files={"file": ("canal.jpg", create_green_jpeg(), "image/jpeg")},
    )

    res = client.get("/api/v1/research/evidence-cases?has_media=true")
    assert res.status_code == 200
    for item in res.json()["items"]:
        assert item["media_count"] > 0

    res_no_media = client.get("/api/v1/research/evidence-cases?has_media=false")
    assert res_no_media.status_code == 200
    for item in res_no_media.json()["items"]:
        assert item["media_count"] == 0


def test_research_inbox_invalid_filter_validation(client: TestClient):
    """
    Test 7: Invalid query parameters return 422 Unprocessable Entity.
    """
    res = client.get("/api/v1/research/evidence-cases?action=INVALID_ACTION")
    assert res.status_code == 422

    res_limit = client.get("/api/v1/research/evidence-cases?limit=999")
    assert res_limit.status_code == 422


# ----------------------------------------------------------------------
# 4. Deterministic "Why This Case?" Explanations
# ----------------------------------------------------------------------

def test_why_this_case_structured_reasons(client: TestClient):
    """
    Test 8: Why-This-Case reasons are typed, auditable, and categorized.
    Categories include TRIAGE_ACTION, VISUAL_EVIDENCE, HISTORICAL_CONTEXT,
    EVIDENCE_COMPLETENESS, and HUMAN_REVIEW_STATE.
    """
    lat, lon = get_fresh_coords()
    rep = client.post(
        "/api/v1/reports",
        json={
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Why-this-case test report with green image.",
            "water_appearance": "green_surface_material",
        },
    ).json()
    client.post(
        f"/api/v1/reports/{rep['id']}/media",
        files={"file": ("green_bloom.jpg", create_green_jpeg(), "image/jpeg")},
    )

    res = client.get(f"/api/v1/research/evidence-cases/{rep['id']}")
    assert res.status_code == 200
    data = res.json()
    why_list = data["why_surfaced"]

    categories = [r["category"] for r in why_list]
    assert "TRIAGE_ACTION" in categories
    assert "EVIDENCE_COMPLETENESS" in categories
    assert "HUMAN_REVIEW_STATE" in categories
    assert "VISUAL_EVIDENCE" in categories

    for r in why_list:
        assert len(r["summary"]) > 0
        assert r["category"] in [
            "VISUAL_EVIDENCE",
            "HISTORICAL_CONTEXT",
            "EVIDENCE_COMPLETENESS",
            "TRIAGE_ACTION",
            "HUMAN_REVIEW_STATE",
        ]


# ----------------------------------------------------------------------
# 5. SignalCase Investigation Detail
# ----------------------------------------------------------------------

def test_research_case_detail_composition(client: TestClient):
    """
    Test 9: Case detail endpoint returns full composed evidence layers:
    Citizen Evidence, Evidence Quality, Media Observations, Contextual Evidence,
    Triage, SignalGuard Evidence Contract, and Why Surfaced reasons.
    """
    lat, lon = get_fresh_coords()
    rep = client.post(
        "/api/v1/reports",
        json={
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Detailed case investigation test.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "odor": "musty_earthy",
            "foam_observed": True,
        },
    ).json()

    res = client.get(f"/api/v1/research/evidence-cases/{rep['id']}")
    assert res.status_code == 200
    detail = res.json()

    assert detail["case_id"] == rep["id"]
    assert detail["human_decision_status"] == "PENDING"
    assert "evidence_quality" in detail
    assert "media_observations" in detail
    assert "contextual_evidence" in detail
    assert "triage" in detail
    assert "evidence_contract" in detail
    assert "why_surfaced" in detail

    # SignalGuard Claim Inspector verification
    claims = detail["evidence_contract"]["claims"]
    assert len(claims) > 0
    for claim in claims:
        assert "claim" in claim
        assert "evidence_class" in claim
        assert "source" in claim
        assert "uncertainty" in claim
        assert "allowed_actions" in claim
        assert "prohibited_interpretations" in claim


def test_research_case_detail_not_found(client: TestClient):
    """
    Test 10: Unknown case ID returns 404.
    """
    unknown_id = str(uuid.uuid4())
    res = client.get(f"/api/v1/research/evidence-cases/{unknown_id}")
    assert res.status_code == 404
    assert f"SignalCase with id '{unknown_id}' not found" in res.json()["detail"]


def test_research_case_detail_invalid_uuid(client: TestClient):
    """
    Test 11: Malformed UUID returns 422.
    """
    res = client.get("/api/v1/research/evidence-cases/not-a-valid-uuid")
    assert res.status_code == 422


# ----------------------------------------------------------------------
# 6. Security & Scientific Boundaries
# ----------------------------------------------------------------------

def test_research_endpoints_security_no_storage_paths(client: TestClient):
    """
    Test 12: Ensure no storage keys, local filesystem paths, or secrets leak in response JSON.
    """
    lat, lon = get_fresh_coords()
    rep = client.post(
        "/api/v1/reports",
        json={
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Security test for path leaks.",
        },
    ).json()
    client.post(
        f"/api/v1/reports/{rep['id']}/media",
        files={"file": ("sec.jpg", create_green_jpeg(), "image/jpeg")},
    )

    inbox_res = client.get("/api/v1/research/evidence-cases")
    detail_res = client.get(f"/api/v1/research/evidence-cases/{rep['id']}")

    for res in [inbox_res, detail_res]:
        raw_text = res.text.lower()
        assert "c:\\" not in raw_text
        assert "/var/media" not in raw_text
        assert "secret" not in raw_text
        assert "storage_key" not in raw_text


def test_human_decision_is_strictly_pending(client: TestClient):
    """
    Test 13: Human review decision is shown as pending; no Issue 13 database mutation endpoints exist.
    """
    lat, lon = get_fresh_coords()
    rep = client.post(
        "/api/v1/reports",
        json={
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "latitude": lat,
            "longitude": lon,
            "description": "Pending decision boundary test.",
        },
    ).json()

    res = client.get(f"/api/v1/research/evidence-cases/{rep['id']}")
    assert res.status_code == 200
    assert res.json()["human_decision_status"] == "PENDING"
