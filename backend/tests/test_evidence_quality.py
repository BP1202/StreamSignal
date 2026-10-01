import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient

from app.schemas.evidence_quality import EvidenceQualityLevel
from app.services.evidence_quality import (
    assess_evidence_quality,
    RECOMMENDATIONS_MAP,
    BASELINE_DIMENSIONS,
)


def test_complete_report_quality(client: TestClient):
    """
    A report with core evidence and all standard contextual fields
    evaluates to COMPLETE with score 1.0.
    """
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Dense green algal layer across stream surface near downstream bank.",
        "water_appearance": "green_surface_material",
        "odor": "musty_earthy",
        "flow_condition": "stagnant",
        "foam_observed": False,
        "litter_observed": False,
        "dead_wildlife_observed": False,
    }
    create_res = client.post("/api/v1/reports", json=payload)
    assert create_res.status_code == 201
    report_id = create_res.json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/evidence-quality")
    assert res.status_code == 200
    data = res.json()

    assert data["report_id"] == report_id
    assert data["quality"] == "COMPLETE"
    assert data["score"] == 1.0
    for dim in ["observation_time", "location", "description", "water_appearance", "flow_condition", "odor"]:
        assert dim in data["present"]
    assert data["missing"] == []
    assert data["recommendations"] == []


def test_partial_report_quality(client: TestClient):
    """
    A report with core evidence but missing contextual fields (e.g. odor and flow_condition)
    evaluates to PARTIAL, identifying missing fields and generating specific recommendations.
    """
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Observed unusual green surface material near the stream edge.",
        "water_appearance": "green_surface_material",
    }
    create_res = client.post("/api/v1/reports", json=payload)
    assert create_res.status_code == 201
    report_id = create_res.json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/evidence-quality")
    assert res.status_code == 200
    data = res.json()

    assert data["report_id"] == report_id
    assert data["quality"] == "PARTIAL"
    assert data["score"] == 0.67  # 4 present out of 6 baseline dimensions
    assert "observation_time" in data["present"]
    assert "location" in data["present"]
    assert "description" in data["present"]
    assert "water_appearance" in data["present"]

    assert "flow_condition" in data["missing"]
    assert "odor" in data["missing"]
    assert RECOMMENDATIONS_MAP["flow_condition"] in data["recommendations"]
    assert RECOMMENDATIONS_MAP["odor"] in data["recommendations"]


def test_insufficient_report_service():
    """
    Direct service test for INSUFFICIENT quality:
    Because our database schema and API validation enforce non-null core fields
    (latitude, longitude, description, observed_at), a report with missing core
    fields cannot be persisted through the API. We verify the service layer directly
    to ensure missing core evidence triggers INSUFFICIENT quality without weakening
    database constraints.
    """
    # Missing location
    mock_report = SimpleNamespace(
        id=uuid.uuid4(),
        observed_at=datetime.now(timezone.utc),
        latitude=None,
        longitude=None,
        description="Observed cloudy water in stream segment.",
        water_appearance="cloudy",
        flow_condition="flowing",
        odor=None,
        foam_observed=False,
        litter_observed=False,
        dead_wildlife_observed=False,
    )

    assessment = assess_evidence_quality(mock_report)
    assert assessment.quality == EvidenceQualityLevel.INSUFFICIENT
    assert "location" in assessment.missing
    assert RECOMMENDATIONS_MAP["location"] in assessment.recommendations
    assert assessment.score < 1.0


def test_recommendations_mapping():
    """
    Verify each missing baseline dimension generates the exact expected deterministic recommendation.
    """
    mock_report = SimpleNamespace(
        id=uuid.uuid4(),
        observed_at=None,
        latitude=None,
        longitude=None,
        description=None,
        water_appearance=None,
        flow_condition=None,
        odor=None,
        foam_observed=False,
        litter_observed=False,
        dead_wildlife_observed=False,
    )

    assessment = assess_evidence_quality(mock_report)
    assert assessment.quality == EvidenceQualityLevel.INSUFFICIENT
    assert set(assessment.missing) == set(BASELINE_DIMENSIONS)
    assert len(assessment.recommendations) == len(BASELINE_DIMENSIONS)
    for dim in BASELINE_DIMENSIONS:
        assert RECOMMENDATIONS_MAP[dim] in assessment.recommendations


def test_score_calculation_bounds():
    """
    Verify that evidence completeness score is deterministic and strictly bounded in [0.0, 1.0].
    """
    # Empty report -> 0.0
    empty_report = SimpleNamespace(
        id=uuid.uuid4(),
        observed_at=None,
        latitude=None,
        longitude=None,
        description=None,
        water_appearance=None,
        flow_condition=None,
        odor=None,
    )
    assert assess_evidence_quality(empty_report).score == 0.0

    # Minimal report (3 core fields) -> 0.50 (3 / 6)
    minimal_report = SimpleNamespace(
        id=uuid.uuid4(),
        observed_at=datetime.now(timezone.utc),
        latitude=10.0,
        longitude=20.0,
        description="Adequate description here",
        water_appearance=None,
        flow_condition=None,
        odor=None,
    )
    assert assess_evidence_quality(minimal_report).score == 0.50

    # Complete report (6 fields) -> 1.0
    full_report = SimpleNamespace(
        id=uuid.uuid4(),
        observed_at=datetime.now(timezone.utc),
        latitude=10.0,
        longitude=20.0,
        description="Adequate description here",
        water_appearance="clear",
        flow_condition="flowing",
        odor="none",
    )
    assert assess_evidence_quality(full_report).score == 1.0


def test_boolean_semantics_affirmative_vs_default(client: TestClient):
    """
    Verify boolean semantics:
    - foam_observed=True adds foam_observation to present.
    - foam_observed=False is the database default and is NOT interpreted as verified absence
      or penalized as missing baseline evidence.
    """
    payload_affirmative = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "White thick foam observed bubbling near stormwater outfall pipe.",
        "water_appearance": "foamy",
        "foam_observed": True,
    }
    res_pos = client.post("/api/v1/reports", json=payload_affirmative)
    assert res_pos.status_code == 201
    rep_id_pos = res_pos.json()["id"]

    quality_pos = client.get(f"/api/v1/reports/{rep_id_pos}/evidence-quality").json()
    assert "foam_observation" in quality_pos["present"]

    # When False, foam_observation should not be in present, and should not be in missing
    payload_default = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Standard observation without foam mentioned.",
        "water_appearance": "clear",
        "foam_observed": False,
    }
    res_def = client.post("/api/v1/reports", json=payload_default)
    assert res_def.status_code == 201
    rep_id_def = res_def.json()["id"]

    quality_def = client.get(f"/api/v1/reports/{rep_id_def}/evidence-quality").json()
    assert "foam_observation" not in quality_def["present"]
    assert "foam_observation" not in quality_def["missing"]


def test_get_evidence_quality_not_found(client: TestClient):
    """Requesting evidence quality for a non-existent report returns 404 Not Found."""
    random_uuid = str(uuid.uuid4())
    res = client.get(f"/api/v1/reports/{random_uuid}/evidence-quality")
    assert res.status_code == 404
    assert f"Report with id '{random_uuid}' not found" in res.json()["detail"]


def test_get_evidence_quality_invalid_uuid(client: TestClient):
    """Requesting evidence quality with an invalid UUID format returns 422 Unprocessable Entity."""
    res = client.get("/api/v1/reports/not-a-valid-uuid/evidence-quality")
    assert res.status_code == 422


def test_no_false_scientific_claims(client: TestClient):
    """
    Ensure evidence assessment output makes no medical, pollution, or diagnostic claims.
    """
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Observation for scientific claim safety test.",
    }
    create_res = client.post("/api/v1/reports", json=payload)
    assert create_res.status_code == 201
    report_id = create_res.json()["id"]

    res = client.get(f"/api/v1/reports/{report_id}/evidence-quality")
    assert res.status_code == 200
    text_content = res.text.lower()

    prohibited_terms = [
        "pollution detected",
        "toxic",
        "toxicity",
        "unsafe",
        "disease risk",
        "confirmed contamination",
        "pathogen",
        "poison",
    ]
    for term in prohibited_terms:
        assert term not in text_content, f"Found prohibited claim term '{term}' in assessment response"
