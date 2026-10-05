import io
import random
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from PIL import Image
from fastapi.testclient import TestClient


def get_unique_base_coords() -> tuple[float, float]:
    """Generate fresh coordinates per test to avoid collision with previous runs in DB."""
    return (
        round(random.uniform(10.0, 40.0), 4),
        round(random.uniform(10.0, 40.0), 4),
    )


def create_green_jpeg() -> bytes:
    """Generate in-memory test JPEG with noticeable green color."""
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(20, 160, 40))
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ----------------------------------------------------------------------
# 1. Basic API Behavior & No Matches
# ----------------------------------------------------------------------

def test_contextual_evidence_no_matches(client: TestClient):
    """
    Test 1: When no historical reports exist within time/space boundaries,
    returns 200 with status NO_MATCHES and empty matches array.
    """
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)
    # Unique isolated location where no other report exists
    payload = {
        "observed_at": now.isoformat(),
        "latitude": 51.1001,
        "longitude": 10.1001,
        "description": "Isolated observation with no historical reports around.",
        "water_appearance": "green_surface_material",
        "flow_condition": "stagnant",
        "foam_observed": True,
    }
    res = client.post("/api/v1/reports", json=payload)
    assert res.status_code == 201
    report_id = res.json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/contextual-evidence")
    assert res.status_code == 200
    data = res.json()

    assert data["report_id"] == report_id
    assert data["status"] == "NO_MATCHES"
    assert data["matches"] == []
    assert "No similar historical observations" in data["summary"]
    assert "Historical similarity indicates recurrence" in data["interpretation_limit"]


def test_contextual_evidence_not_found(client: TestClient):
    """Test 2: Requesting contextual evidence for unknown report returns 404."""
    random_uuid = str(uuid.uuid4())
    res = client.get(f"/api/v1/reports/{random_uuid}/contextual-evidence")
    assert res.status_code == 404
    assert f"Report with id '{random_uuid}' not found" in res.json()["detail"]


def test_contextual_evidence_invalid_uuid(client: TestClient):
    """Test 3: Malformed UUID returns 422 Unprocessable Entity."""
    res = client.get("/api/v1/reports/not-a-valid-uuid/contextual-evidence")
    assert res.status_code == 422


# ----------------------------------------------------------------------
# 2. Spatial & Temporal Bounded Filtering
# ----------------------------------------------------------------------

def test_spatial_proximity_filtering(client: TestClient):
    """
    Test 4: Reports within search radius are candidates; reports outside radius are excluded.
    """
    base_lat, base_lon = get_unique_base_coords()
    current_time = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)

    # Current report
    cur_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": current_time.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Current canal report for spatial test.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "foam_observed": True,
        },
    )
    assert cur_res.status_code == 201
    report_id = cur_res.json()["id"]

    # 1. Nearby report (~250 meters away: 0.0022 deg lat) 3 days earlier
    nearby_payload = {
        "observed_at": (current_time - timedelta(days=3)).isoformat(),
        "latitude": base_lat + 0.0022,
        "longitude": base_lon,
        "description": "Nearby historical report with green material.",
        "water_appearance": "green_surface_material",
        "flow_condition": "stagnant",
        "foam_observed": True,
    }
    nearby_res = client.post("/api/v1/reports", json=nearby_payload)
    assert nearby_res.status_code == 201
    nearby_id = nearby_res.json()["id"]

    # 2. Distant report (~15 km away: 0.135 deg lat) 3 days earlier
    distant_payload = {
        "observed_at": (current_time - timedelta(days=3)).isoformat(),
        "latitude": base_lat + 0.135,
        "longitude": base_lon,
        "description": "Distant historical report with same appearance.",
        "water_appearance": "green_surface_material",
        "flow_condition": "stagnant",
        "foam_observed": True,
    }
    distant_res = client.post("/api/v1/reports", json=distant_payload)
    assert distant_res.status_code == 201
    distant_id = distant_res.json()["id"]

    # Fetch contextual evidence with default 1000m radius
    res = client.get(f"/api/v1/reports/{report_id}/contextual-evidence")
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "AVAILABLE"
    matched_ids = [m["report_id"] for m in data["matches"]]
    assert nearby_id in matched_ids
    assert distant_id not in matched_ids


def test_temporal_window_and_future_exclusion(client: TestClient):
    """
    Test 5: Recent historical reports within window are included;
    reports older than historical window (e.g. >30 days) and future reports are strictly excluded.
    """
    base_lat, base_lon = get_unique_base_coords()
    current_time = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)

    cur_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": current_time.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Current report for temporal test.",
            "water_appearance": "green_surface_material",
        },
    )
    report_id = cur_res.json()["id"]

    # 1. Valid historical: 10 days earlier, nearby
    recent_payload = {
        "observed_at": (current_time - timedelta(days=10)).isoformat(),
        "latitude": base_lat + 0.001,
        "longitude": base_lon,
        "description": "Recent observation within 30-day window.",
        "water_appearance": "green_surface_material",
    }
    recent_id = client.post("/api/v1/reports", json=recent_payload).json()["id"]

    # 2. Too old: 45 days earlier (> 30 days)
    old_payload = {
        "observed_at": (current_time - timedelta(days=45)).isoformat(),
        "latitude": base_lat + 0.001,
        "longitude": base_lon,
        "description": "Too old observation outside 30-day window.",
        "water_appearance": "green_surface_material",
    }
    old_id = client.post("/api/v1/reports", json=old_payload).json()["id"]

    # 3. Future observation: observed_at > current report
    future_payload = {
        "observed_at": (current_time + timedelta(days=2)).isoformat(),
        "latitude": base_lat + 0.001,
        "longitude": base_lon,
        "description": "Future observation should never be historical context.",
        "water_appearance": "green_surface_material",
    }
    future_id = client.post("/api/v1/reports", json=future_payload).json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/contextual-evidence")
    assert res.status_code == 200
    matched_ids = [m["report_id"] for m in res.json()["matches"]]

    assert recent_id in matched_ids
    assert old_id not in matched_ids
    assert future_id not in matched_ids


def test_never_self_matches(client: TestClient):
    """
    Test 6: The current report must never be returned as its own historical match.
    """
    base_lat = 54.4000
    base_lon = 13.4000
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)
    cur_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Current report self-match test.",
            "water_appearance": "green_surface_material",
        },
    )
    report_id = cur_res.json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/contextual-evidence")
    assert res.status_code == 200
    matched_ids = [m["report_id"] for m in res.json()["matches"]]
    assert report_id not in matched_ids


# ----------------------------------------------------------------------
# 3. Structured Signals & Negative Boolean Semantics
# ----------------------------------------------------------------------

def test_structured_signals_and_negative_boolean_rule(client: TestClient):
    """
    Test 7: Matching structured fields (water_appearance, flow, odor, positive booleans)
    generate transparent matched_signals and explanations.
    False boolean values (e.g. litter_observed=False) do NOT count as a similarity match.
    """
    base_lat, base_lon = get_unique_base_coords()
    current_time = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)

    cur_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": current_time.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Base canal observation of surface discoloration and foam.",
            "water_appearance": "green_surface_material",
            "flow_condition": "stagnant",
            "odor": "musty_earthy",
            "foam_observed": True,
            "litter_observed": False,
            "dead_wildlife_observed": False,
        },
    )
    report_id = cur_res.json()["id"]

    cand_payload = {
        "observed_at": (current_time - timedelta(days=5)).isoformat(),
        "latitude": base_lat + 0.001,
        "longitude": base_lon,
        "description": "Historical observation with foam and green water.",
        "water_appearance": "green_surface_material",
        "flow_condition": "stagnant",
        "odor": None,
        "foam_observed": True,
        "litter_observed": False,
        "dead_wildlife_observed": False,
    }
    cand_id = client.post("/api/v1/reports", json=cand_payload).json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/contextual-evidence")
    assert res.status_code == 200
    data = res.json()

    matched = [m for m in data["matches"] if m["report_id"] == cand_id]
    assert len(matched) == 1
    match = matched[0]
    signals = match["matched_signals"]

    assert "same_water_appearance" in signals
    assert "same_flow_condition" in signals
    assert "same_positive_foam_observation" in signals

    # Ensure negative boolean was not treated as a similarity match
    assert "same_litter_observed" not in signals
    assert "same_dead_wildlife_observed" not in signals

    # Explanations check
    explanations = match["similarity_explanation"]
    assert any("within" in exp.lower() for exp in explanations)
    assert any("days earlier" in exp.lower() for exp in explanations)
    assert any("water appearance" in exp.lower() for exp in explanations)


# ----------------------------------------------------------------------
# 4. Media Visual Observation Similarity (Issue 8 Reuse)
# ----------------------------------------------------------------------

def test_shared_visual_observations_contribute_to_similarity(client: TestClient):
    """
    Test 8: Reuses Issue 8 visual observation extraction. When both reports have
    visual media sharing an observation (e.g. GREEN_VISUAL_REGION), it is included
    in matched_signals and explanations.
    """
    base_lat, base_lon = get_unique_base_coords()
    current_time = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)

    cur_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": current_time.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Current report for visual observation sharing.",
        },
    )
    report_id = cur_res.json()["id"]

    # Attach green image to current report
    green_bytes = create_green_jpeg()
    upload1 = client.post(
        f"/api/v1/reports/{report_id}/media",
        files={"file": ("current_green.jpg", green_bytes, "image/jpeg")},
    )
    assert upload1.status_code == 201

    # Create historical report with green image
    hist_payload = {
        "observed_at": (current_time - timedelta(days=4)).isoformat(),
        "latitude": base_lat + 0.001,
        "longitude": base_lon,
        "description": "Historical observation with green image.",
    }
    hist_res = client.post("/api/v1/reports", json=hist_payload)
    hist_id = hist_res.json()["id"]

    upload2 = client.post(
        f"/api/v1/reports/{hist_id}/media",
        files={"file": ("hist_green.jpg", green_bytes, "image/jpeg")},
    )
    assert upload2.status_code == 201

    res = client.get(f"/api/v1/reports/{report_id}/contextual-evidence")
    assert res.status_code == 200
    data = res.json()

    matched = [m for m in data["matches"] if m["report_id"] == hist_id]
    assert len(matched) == 1
    match = matched[0]

    assert "shared_green_visual_region" in match["matched_signals"]
    assert any("GREEN_VISUAL_REGION" in exp for exp in match["similarity_explanation"])


# ----------------------------------------------------------------------
# 5. Determinism & Provenance
# ----------------------------------------------------------------------

def test_deterministic_contextual_ordering(client: TestClient):
    """
    Test 9: Repeated requests produce identical match order, signals, and explanations.
    """
    base_lat = 57.7000
    base_lon = 16.7000
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)
    cur_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Determinism test report.",
            "water_appearance": "green_surface_material",
        },
    )
    report_id = cur_res.json()["id"]

    res1 = client.get(f"/api/v1/reports/{report_id}/contextual-evidence").json()
    res2 = client.get(f"/api/v1/reports/{report_id}/contextual-evidence").json()

    assert res1 == res2


def test_provenance_and_security(client: TestClient):
    """
    Test 10: Every match contains the historical report_id. No storage keys or paths are exposed.
    """
    base_lat = 58.8000
    base_lon = 17.8000
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)
    cur_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Provenance test report.",
            "water_appearance": "green_surface_material",
        },
    )
    report_id = cur_res.json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/contextual-evidence")
    assert res.status_code == 200
    data = res.json()

    for match in data["matches"]:
        assert "report_id" in match
        assert uuid.UUID(match["report_id"])

    raw_text = res.text.lower()
    assert "storage_key" not in raw_text
    assert "media_storage" not in raw_text
    assert "c:\\" not in raw_text
    assert "/var/" not in raw_text


# ----------------------------------------------------------------------
# 6. Scientific Safety
# ----------------------------------------------------------------------

def test_scientific_safety_boundaries(client: TestClient):
    """
    Test 11: Pattern Echo must communicate interpretation limits and never conclude
    pollution confirmation, toxicity, contamination spreading, or causation.
    """
    base_lat = 59.9000
    base_lon = 18.9000
    now = datetime(2026, 10, 1, 12, 0, 0, tzinfo=timezone.utc)
    cur_res = client.post(
        "/api/v1/reports",
        json={
            "observed_at": now.isoformat(),
            "latitude": base_lat,
            "longitude": base_lon,
            "description": "Safety test report.",
        },
    )
    report_id = cur_res.json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/contextual-evidence")
    assert res.status_code == 200
    data = res.json()

    assert "interpretation_limit" in data
    assert "does not establish environmental cause" in data["interpretation_limit"].lower()

    text_lower = res.text.lower()
    prohibited_conclusions = [
        "pollution is recurring",
        "contamination is spreading",
        "this proves an algae bloom",
        "water is contaminated",
        "historical reports have the same cause",
        "health risk confirmed",
        "toxicity confirmed",
        "cause confirmed",
    ]
    for prohibited in prohibited_conclusions:
        assert prohibited not in text_lower, f"Prohibited conclusion found: '{prohibited}'"
