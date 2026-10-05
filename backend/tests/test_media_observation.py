import io
import uuid
from datetime import datetime, timezone
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.models.report import Report


@pytest.fixture
def sample_report_id(client: TestClient) -> str:
    """Create a standard citizen observation report."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Observed water channel segment for visual observation test.",
        "water_appearance": "green_surface_material",
        "flow_condition": "stagnant",
        "odor": None,
        "foam_observed": False,
        "litter_observed": False,
        "dead_wildlife_observed": False,
    }
    res = client.post("/api/v1/reports", json=payload)
    assert res.status_code == 201
    return res.json()["id"]


def create_solid_color_jpeg(r: int, g: int, b: int, size: tuple = (100, 100)) -> bytes:
    """Generate in-memory test JPEG with solid RGB color."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=(r, g, b))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def create_foam_pattern_jpeg() -> bytes:
    """Generate in-memory test JPEG with dark water and bright foam-like patches."""
    img = Image.new("RGB", (120, 120), color=(20, 40, 60))
    # Add a bright cluster simulating surface foam
    for x in range(30, 60):
        for y in range(30, 60):
            img.putpixel((x, y), (235, 240, 245))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def create_brown_water_jpeg() -> bytes:
    """Generate in-memory test JPEG with brownish sediment discoloration."""
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(110, 75, 40))
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ----------------------------------------------------------------------
# 1. API Basics & Empty Media
# ----------------------------------------------------------------------

def test_get_media_observations_no_media(client: TestClient, sample_report_id: str):
    """
    Test 1: Report with no attached media returns 200 with an empty media list.
    Absence of media is not treated as a scientific observation.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/media-observations")
    assert res.status_code == 200
    data = res.json()
    assert data["report_id"] == sample_report_id
    assert data["media"] == []


def test_get_media_observations_not_found(client: TestClient):
    """Test 2: Requesting observations for non-existent report returns 404."""
    random_uuid = str(uuid.uuid4())
    res = client.get(f"/api/v1/reports/{random_uuid}/media-observations")
    assert res.status_code == 404
    assert f"Report with id '{random_uuid}' not found" in res.json()["detail"]


def test_get_media_observations_invalid_uuid(client: TestClient):
    """Test 3: Malformed UUID returns 422 Unprocessable Entity."""
    res = client.get("/api/v1/reports/invalid-uuid-format/media-observations")
    assert res.status_code == 422


# ----------------------------------------------------------------------
# 2. Visual Signal Extraction & Evidence Classification (E2_OBSERVED)
# ----------------------------------------------------------------------

def test_extract_green_visual_region(client: TestClient, sample_report_id: str):
    """
    Test 4: Media with dominant green color yields GREEN_VISUAL_REGION observation
    classified strictly as E2_OBSERVED with explicit uncertainty.
    """
    green_bytes = create_solid_color_jpeg(20, 160, 40)
    upload_res = client.post(
        f"/api/v1/reports/{sample_report_id}/media",
        files={"file": ("green_water.jpg", green_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    media_id = upload_res.json()["id"]

    res = client.get(f"/api/v1/reports/{sample_report_id}/media-observations")
    assert res.status_code == 200
    data = res.json()

    assert data["report_id"] == sample_report_id
    assert len(data["media"]) >= 1

    matched = [m for m in data["media"] if m["media_id"] == media_id]
    assert len(matched) == 1
    media_obs = matched[0]

    obs_types = [o["observation_type"] for o in media_obs["observations"]]
    assert "GREEN_VISUAL_REGION" in obs_types

    green_obs = [o for o in media_obs["observations"] if o["observation_type"] == "GREEN_VISUAL_REGION"][0]
    assert green_obs["evidence_class"] == "E2_OBSERVED"
    assert "green-colored visual region" in green_obs["description"].lower()
    assert len(green_obs["uncertainty"]) > 0
    assert "lighting" in green_obs["uncertainty"].lower() or "reflection" in green_obs["uncertainty"].lower()

    # Support metadata verification
    support = green_obs["support"]
    assert support["media_id"] == media_id
    assert support["sha256"] == upload_res.json()["sha256"]
    assert support["content_type"] == "image/jpeg"


def test_extract_dark_brown_discoloration(client: TestClient, sample_report_id: str):
    """
    Test 5: Media with brown/sediment color yields DARK_OR_BROWN_DISCOLORATION.
    """
    brown_bytes = create_brown_water_jpeg()
    upload_res = client.post(
        f"/api/v1/reports/{sample_report_id}/media",
        files={"file": ("turbid_water.jpg", brown_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    media_id = upload_res.json()["id"]

    res = client.get(f"/api/v1/reports/{sample_report_id}/media-observations")
    assert res.status_code == 200
    data = res.json()

    matched = [m for m in data["media"] if m["media_id"] == media_id][0]
    obs_types = [o["observation_type"] for o in matched["observations"]]
    assert "DARK_OR_BROWN_DISCOLORATION" in obs_types

    brown_obs = [o for o in matched["observations"] if o["observation_type"] == "DARK_OR_BROWN_DISCOLORATION"][0]
    assert brown_obs["evidence_class"] == "E2_OBSERVED"
    assert "dark or brown" in brown_obs["description"].lower()


def test_extract_foam_like_surface_pattern(client: TestClient, sample_report_id: str):
    """
    Test 6: Media with bright surface patches yields FOAM_LIKE_SURFACE_PATTERN.
    """
    foam_bytes = create_foam_pattern_jpeg()
    upload_res = client.post(
        f"/api/v1/reports/{sample_report_id}/media",
        files={"file": ("foam_water.jpg", foam_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    media_id = upload_res.json()["id"]

    res = client.get(f"/api/v1/reports/{sample_report_id}/media-observations")
    assert res.status_code == 200
    data = res.json()

    matched = [m for m in data["media"] if m["media_id"] == media_id][0]
    obs_types = [o["observation_type"] for o in matched["observations"]]
    assert "FOAM_LIKE_SURFACE_PATTERN" in obs_types


def test_extract_image_too_dark(client: TestClient, sample_report_id: str):
    """
    Test 7: Very dark image yields IMAGE_TOO_DARK observation.
    """
    dark_bytes = create_solid_color_jpeg(5, 5, 5)
    upload_res = client.post(
        f"/api/v1/reports/{sample_report_id}/media",
        files={"file": ("night_water.jpg", dark_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    media_id = upload_res.json()["id"]

    res = client.get(f"/api/v1/reports/{sample_report_id}/media-observations")
    assert res.status_code == 200
    data = res.json()

    matched = [m for m in data["media"] if m["media_id"] == media_id][0]
    obs_types = [o["observation_type"] for o in matched["observations"]]
    assert "IMAGE_TOO_DARK" in obs_types


# ----------------------------------------------------------------------
# 3. Scientific Safety: No Diagnoses / No Hallucinated Claims
# ----------------------------------------------------------------------

def test_scientific_safety_boundaries(client: TestClient, sample_report_id: str):
    """
    Test 8: Ensure visual observations never assert pollution, toxicity,
    algae bloom confirmation, pathogens, or causal claims.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/media-observations")
    assert res.status_code == 200
    text_lower = res.text.lower()

    prohibited_keywords = [
        "pollution confirmed",
        "water is polluted",
        "toxicity confirmed",
        "water is toxic",
        "algae bloom detected",
        "algae bloom confirmed",
        "pathogen detected",
        "health risk confirmed",
        "chemical contamination",
        "sewage contamination",
        "cause confirmed",
    ]
    for kw in prohibited_keywords:
        assert kw not in text_lower, f"Prohibited diagnostic keyword found: '{kw}'"


def test_no_claims_classified_as_e3_e4_e5(client: TestClient, sample_report_id: str):
    """
    Test 9: All media visual observations must be classified strictly as E2_OBSERVED.
    Never classify as E3, E4, or E5.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/media-observations")
    assert res.status_code == 200
    for media_item in res.json()["media"]:
        for obs in media_item["observations"]:
            assert obs["evidence_class"] == "E2_OBSERVED"
            assert obs["evidence_class"] not in ["E3_INFERRED", "E4_CORROBORATED", "E5_VERIFIED"]


# ----------------------------------------------------------------------
# 4. Determinism & Traceability
# ----------------------------------------------------------------------

def test_deterministic_observations_and_ids(client: TestClient, sample_report_id: str):
    """
    Test 10: Repeated requests produce identical observation IDs, order, and content.
    """
    res1 = client.get(f"/api/v1/reports/{sample_report_id}/media-observations").json()
    res2 = client.get(f"/api/v1/reports/{sample_report_id}/media-observations").json()

    assert res1 == res2
    for m1, m2 in zip(res1["media"], res2["media"]):
        assert m1["media_id"] == m2["media_id"]
        for o1, o2 in zip(m1["observations"], m2["observations"]):
            assert o1["observation_id"] == o2["observation_id"]
            assert o1["observation_type"] == o2["observation_type"]
            assert o1["description"] == o2["description"]


def test_no_filesystem_paths_or_keys_exposed(client: TestClient, sample_report_id: str):
    """
    Test 11: Security check - ensure no filesystem storage keys or roots are exposed.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/media-observations")
    assert res.status_code == 200
    raw_text = res.text.lower()

    assert "storage_key" not in raw_text
    assert "media_storage" not in raw_text
    assert "c:\\" not in raw_text
    assert "/var/" not in raw_text
