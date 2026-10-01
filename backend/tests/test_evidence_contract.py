import io
import uuid
from datetime import datetime, timezone
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.models.report import Report


@pytest.fixture
def sample_report_id(client: TestClient) -> str:
    """Create a standard citizen observation report with structured fields."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Observed unusual surface discoloration along urban canal segment.",
        "water_appearance": "green_surface_material",
        "flow_condition": "stagnant",
        "odor": "musty_earthy",
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


# ----------------------------------------------------------------------
# 1. Basic Endpoint Contract & Schema
# ----------------------------------------------------------------------

def test_get_evidence_contract_success(client: TestClient, sample_report_id: str):
    """
    Test 1: Existing report returns 200 with deterministic identifiers,
    pending_review status, claims array, and provenance.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract")
    assert res.status_code == 200
    data = res.json()

    assert data["report_id"] == sample_report_id
    assert data["case_id"] == sample_report_id
    assert data["status"] == "pending_review"
    assert isinstance(data["claims"], list)
    assert len(data["claims"]) > 0

    prov = data["provenance"]
    assert prov["source"] == "streamsignal"
    assert "generated_at" in prov
    assert "citizen_report" in prov["components"]


# ----------------------------------------------------------------------
# 2. Evidence Classes: E1 Reported & E2 Observed
# ----------------------------------------------------------------------

def test_citizen_description_and_structured_fields_are_e1(client: TestClient, sample_report_id: str):
    """
    Test 2: Citizen description and structured fields remain E1_REPORTED.
    They must NOT be upgraded to E2, E3, E4, or E5.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract")
    assert res.status_code == 200
    claims = res.json()["claims"]

    # Locate description claim
    desc_claims = [c for c in claims if c["source"] == "report.description"]
    assert len(desc_claims) == 1
    desc_claim = desc_claims[0]
    assert desc_claim["evidence_class"] == "E1_REPORTED"
    assert "unusual surface discoloration" in desc_claim["claim"]

    # Locate water appearance claim
    wa_claims = [c for c in claims if c["source"] == "report.water_appearance"]
    assert len(wa_claims) == 1
    assert wa_claims[0]["evidence_class"] == "E1_REPORTED"

    # Locate flow condition claim
    fc_claims = [c for c in claims if c["source"] == "report.flow_condition"]
    assert len(fc_claims) == 1
    assert fc_claims[0]["evidence_class"] == "E1_REPORTED"

    # Locate odor claim
    odor_claims = [c for c in claims if c["source"] == "report.odor"]
    assert len(odor_claims) == 1
    assert odor_claims[0]["evidence_class"] == "E1_REPORTED"

    # Locate foam claim (foam_observed was True)
    foam_claims = [c for c in claims if c["source"] == "report.foam_observed"]
    assert len(foam_claims) == 1
    assert foam_claims[0]["evidence_class"] == "E1_REPORTED"


def test_boolean_fields_handling(client: TestClient, sample_report_id: str):
    """
    Test 3: Boolean fields where value is False must NOT generate claims.
    False does not mean verified absence (e.g. no claim 'No litter exists').
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract")
    assert res.status_code == 200
    claims = res.json()["claims"]

    litter_claims = [c for c in claims if c["source"] == "report.litter_observed"]
    assert len(litter_claims) == 0, "False litter_observed must not generate an affirmative claim"

    dead_wildlife_claims = [c for c in claims if c["source"] == "report.dead_wildlife_observed"]
    assert len(dead_wildlife_claims) == 0, "False dead_wildlife_observed must not generate a claim"


def test_media_evidence_is_e2_observed_only_for_media_presence(client: TestClient, sample_report_id: str):
    """
    Test 4: Attached media generates an E2_OBSERVED claim strictly for media presence,
    not for computer-vision conclusions.
    """
    # Upload media to report
    img_bytes = create_test_jpeg_bytes()
    upload_res = client.post(
        f"/api/v1/reports/{sample_report_id}/media",
        files={"file": ("stream_sample.jpg", img_bytes, "image/jpeg")},
    )
    assert upload_res.status_code == 201
    media_info = upload_res.json()

    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract")
    assert res.status_code == 200
    claims = res.json()["claims"]

    media_claims = [c for c in claims if c["source"] == "report_media"]
    assert len(media_claims) == 1
    m_claim = media_claims[0]

    assert m_claim["evidence_class"] == "E2_OBSERVED"
    assert "visual media evidence was submitted" in m_claim["claim"].lower()
    assert any(media_info["sha256"] in s for s in m_claim["support"])

    # Uncertainty must clarify that presence does not establish meaning/cause
    assert any("does not establish the environmental meaning" in u.lower() for u in m_claim["uncertainty"])


def test_no_claims_classified_as_e3_e4_e5(client: TestClient, sample_report_id: str):
    """
    Test 5: SignalGuard must NOT classify any current claims as E3, E4, or E5,
    since no AI model, sensor corroboration, or expert verification has been executed.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract")
    assert res.status_code == 200
    claims = res.json()["claims"]

    for claim in claims:
        assert claim["evidence_class"] in ["E1_REPORTED", "E2_OBSERVED"]
        assert claim["evidence_class"] not in ["E3_INFERRED", "E4_CORROBORATED", "E5_VERIFIED"]


# ----------------------------------------------------------------------
# 3. Scientific Safety: Prohibited Interpretations & No Fake Metrics
# ----------------------------------------------------------------------

def test_scientific_prohibitions_and_no_fake_metrics(client: TestClient, sample_report_id: str):
    """
    Test 6: All claims must explicitly declare prohibited interpretations.
    Contract must contain no scientific claims, no diagnostic claims, and no fake numerical confidence.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract")
    assert res.status_code == 200
    claims = res.json()["claims"]

    required_prohibitions = {
        "POLLUTION_CONFIRMED",
        "TOXICITY_CONFIRMED",
        "HEALTH_RISK_CONFIRMED",
        "CAUSE_CONFIRMED",
    }

    for claim in claims:
        prohibitions = set(claim["prohibited_interpretations"])
        assert required_prohibitions.issubset(prohibitions), (
            f"Claim {claim['claim_id']} missing required prohibited interpretations"
        )

    # Check whole response text for prohibited overclaiming and numerical confidence
    text = res.text.lower()
    assert "water is toxic" not in text
    assert "water is polluted" not in text
    assert "algae bloom confirmed" not in text
    assert "confidence:" not in text
    assert "risk_score" not in text
    assert "probability:" not in text


# ----------------------------------------------------------------------
# 4. Uncertainty & Allowed Actions Vocabulary
# ----------------------------------------------------------------------

def test_uncertainty_and_allowed_actions(client: TestClient, sample_report_id: str):
    """
    Test 7: Claims contain explicit uncertainty statements and restricted allowed actions.
    """
    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract")
    assert res.status_code == 200
    claims = res.json()["claims"]

    valid_actions = {"MONITOR", "REQUEST_MORE_EVIDENCE", "EXPERT_REVIEW", "FIELD_VERIFICATION"}

    for claim in claims:
        assert len(claim["uncertainty"]) > 0, f"Claim {claim['claim_id']} must document uncertainty"
        assert len(claim["allowed_actions"]) > 0, f"Claim {claim['claim_id']} must have allowed actions"
        for action in claim["allowed_actions"]:
            assert action in valid_actions, f"Invalid action {action} in claim {claim['claim_id']}"


def test_dead_wildlife_supports_field_verification_action(client: TestClient):
    """
    Test 8: When dead wildlife is observed, FIELD_VERIFICATION is an allowed action.
    """
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Found multiple dead fish along canal embankment.",
        "dead_wildlife_observed": True,
    }
    res = client.post("/api/v1/reports", json=payload)
    assert res.status_code == 201
    report_id = res.json()["id"]

    contract_res = client.get(f"/api/v1/reports/{report_id}/evidence-contract")
    assert contract_res.status_code == 200
    claims = contract_res.json()["claims"]

    dw_claims = [c for c in claims if c["source"] == "report.dead_wildlife_observed"]
    assert len(dw_claims) == 1
    assert "FIELD_VERIFICATION" in dw_claims[0]["allowed_actions"]


# ----------------------------------------------------------------------
# 5. Determinism: Stable IDs & Deterministic Ordering
# ----------------------------------------------------------------------

def test_deterministic_claim_ids_and_ordering(client: TestClient, sample_report_id: str):
    """
    Test 9: Calling endpoint multiple times returns identical claim IDs in identical order.
    """
    res1 = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract").json()
    res2 = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract").json()

    claims1 = res1["claims"]
    claims2 = res2["claims"]

    assert len(claims1) == len(claims2)
    for c1, c2 in zip(claims1, claims2):
        assert c1["claim_id"] == c2["claim_id"]
        assert c1["source"] == c2["source"]
        assert c1["evidence_class"] == c2["evidence_class"]
        assert c1["claim"] == c2["claim"]


# ----------------------------------------------------------------------
# 6. Read-Only / Data Integrity
# ----------------------------------------------------------------------

def test_evidence_contract_is_read_only(client: TestClient, sample_report_id: str):
    """
    Test 10: Calling the evidence contract endpoint does not mutate the report.
    """
    db = SessionLocal()
    try:
        report_before = db.query(Report).filter(Report.id == uuid.UUID(sample_report_id)).first()
        updated_at_before = report_before.updated_at
    finally:
        db.close()

    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract")
    assert res.status_code == 200

    db = SessionLocal()
    try:
        report_after = db.query(Report).filter(Report.id == uuid.UUID(sample_report_id)).first()
        assert report_after.updated_at == updated_at_before
    finally:
        db.close()


# ----------------------------------------------------------------------
# 7. Error Handling & Security
# ----------------------------------------------------------------------

def test_evidence_contract_not_found(client: TestClient):
    """Test 11: Missing report returns 404."""
    random_uuid = str(uuid.uuid4())
    res = client.get(f"/api/v1/reports/{random_uuid}/evidence-contract")
    assert res.status_code == 404
    assert f"Report with id '{random_uuid}' not found" in res.json()["detail"]


def test_evidence_contract_invalid_uuid(client: TestClient):
    """Test 12: Malformed UUID returns 422 Unprocessable Entity."""
    res = client.get("/api/v1/reports/not-a-valid-uuid/evidence-contract")
    assert res.status_code == 422


def test_no_filesystem_paths_or_secrets_exposed(client: TestClient, sample_report_id: str):
    """
    Test 13: Ensure no internal filesystem paths, storage roots, or sensitive metadata are exposed.
    """
    # Upload media first
    img_bytes = create_test_jpeg_bytes()
    client.post(
        f"/api/v1/reports/{sample_report_id}/media",
        files={"file": ("test_pic.jpg", img_bytes, "image/jpeg")},
    )

    res = client.get(f"/api/v1/reports/{sample_report_id}/evidence-contract")
    assert res.status_code == 200
    text_lower = res.text.lower()

    assert "storage_key" not in text_lower
    assert "media_storage" not in text_lower
    assert "c:\\" not in text_lower
    assert "/var/" not in text_lower
