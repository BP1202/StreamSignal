import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.models.report import Report


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def partial_report_id(client: TestClient) -> str:
    """Create a report missing water_appearance, flow_condition, and odor."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Initial citizen observation without detailed water context.",
    }
    res = client.post("/api/v1/reports", json=payload)
    assert res.status_code == 201
    return res.json()["id"]


@pytest.fixture
def complete_report_id(client: TestClient) -> str:
    """Create a fully documented report with all contextual fields present."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Full description of freshwater segment near bridge.",
        "water_appearance": "green_surface_material",
        "flow_condition": "flowing",
        "odor": "none_noticed",
    }
    res = client.post("/api/v1/reports", json=payload)
    assert res.status_code == 201
    return res.json()["id"]


def test_complete_report_returns_empty_questions(client: TestClient, complete_report_id: str):
    """When all interviewable dimensions are already present, 0 questions are returned."""
    res = client.get(f"/api/v1/reports/{complete_report_id}/evidence-interview")
    assert res.status_code == 200
    data = res.json()
    assert data["report_id"] == complete_report_id
    assert data["questions"] == []


def test_missing_flow_and_odor_returns_targeted_questions(client: TestClient):
    """Report missing flow_condition and odor generates exactly those two questions."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Observation with appearance provided but missing flow and odor.",
        "water_appearance": "clear",
    }
    create_res = client.post("/api/v1/reports", json=payload)
    assert create_res.status_code == 201
    rep_id = create_res.json()["id"]

    res = client.get(f"/api/v1/reports/{rep_id}/evidence-interview")
    assert res.status_code == 200
    data = res.json()

    question_ids = [q["question_id"] for q in data["questions"]]
    assert question_ids == ["flow_condition", "odor"]
    assert len(data["questions"]) == 2

    # Check question options structure
    flow_q = data["questions"][0]
    assert flow_q["answer_type"] == "single_choice"
    assert any(opt["value"] == "stagnant" for opt in flow_q["options"])


def test_max_two_questions_enforced(client: TestClient, partial_report_id: str):
    """Even if 3 dimensions are missing (appearance, flow, odor), at most 2 questions are returned."""
    res = client.get(f"/api/v1/reports/{partial_report_id}/evidence-interview")
    assert res.status_code == 200
    data = res.json()
    assert len(data["questions"]) == 2
    # Deterministic priority order: water_appearance, then flow_condition
    assert data["questions"][0]["question_id"] == "water_appearance"
    assert data["questions"][1]["question_id"] == "flow_condition"


def test_deterministic_repeatable_questions(client: TestClient, partial_report_id: str):
    """Multiple identical GET calls return the exact same questions and ordering."""
    res1 = client.get(f"/api/v1/reports/{partial_report_id}/evidence-interview").json()
    res2 = client.get(f"/api/v1/reports/{partial_report_id}/evidence-interview").json()
    assert res1 == res2


def test_interview_not_found(client: TestClient):
    """Non-existent report ID returns 404 Not Found."""
    random_uuid = str(uuid.uuid4())
    res = client.get(f"/api/v1/reports/{random_uuid}/evidence-interview")
    assert res.status_code == 404
    assert f"Report with id '{random_uuid}' not found" in res.json()["detail"]


def test_interview_invalid_uuid(client: TestClient):
    """Invalid UUID format returns 422 Unprocessable Entity."""
    res = client.get("/api/v1/reports/not-a-valid-uuid/evidence-interview")
    assert res.status_code == 422


def test_submit_valid_answers(client: TestClient, partial_report_id: str, db):
    """Submitting valid answers updates Report fields and recalculates evidence quality."""
    payload = {
        "answers": [
            {"question_id": "water_appearance", "value": "green_surface_material"},
            {"question_id": "flow_condition", "value": "stagnant"},
        ]
    }
    res = client.post(f"/api/v1/reports/{partial_report_id}/evidence-interview/answers", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["report_id"] == partial_report_id
    assert set(data["updated_fields"]) == {"water_appearance", "flow_condition"}
    assert data["evidence_quality"]["quality"] == "PARTIAL"
    assert data["evidence_quality"]["score"] == 0.83  # 5 out of 6 present
    assert "water_appearance" in data["evidence_quality"]["present"]
    assert "flow_condition" in data["evidence_quality"]["present"]

    # Verify persistence in database
    db_report = db.query(Report).filter(Report.id == partial_report_id).first()
    assert db_report.water_appearance == "green_surface_material"
    assert db_report.flow_condition == "stagnant"


def test_submit_description_answer(client: TestClient, partial_report_id: str, db):
    """Free-text description answers update the description field."""
    payload = {
        "answers": [
            {"question_id": "description", "value": "Updated detailed description of the stream observation."}
        ]
    }
    res = client.post(f"/api/v1/reports/{partial_report_id}/evidence-interview/answers", json=payload)
    assert res.status_code == 200
    assert "description" in res.json()["updated_fields"]

    db_report = db.query(Report).filter(Report.id == partial_report_id).first()
    assert db_report.description == "Updated detailed description of the stream observation."


def test_submit_invalid_enum_rejected(client: TestClient, partial_report_id: str):
    """An answer value not in the allowed option catalog is rejected with 400 Bad Request."""
    payload = {
        "answers": [
            {"question_id": "flow_condition", "value": "hyper_turbulent_tsunami"}
        ]
    }
    res = client.post(f"/api/v1/reports/{partial_report_id}/evidence-interview/answers", json=payload)
    assert res.status_code == 400
    assert "Invalid value" in res.json()["detail"]


def test_submit_unknown_question_id_rejected(client: TestClient, partial_report_id: str):
    """An unknown or unexposed question_id is rejected with 400 Bad Request."""
    payload = {
        "answers": [
            {"question_id": "water_temperature", "value": "25C"}
        ]
    }
    res = client.post(f"/api/v1/reports/{partial_report_id}/evidence-interview/answers", json=payload)
    assert res.status_code == 400
    assert "Unknown question_id" in res.json()["detail"]


def test_submit_empty_description_rejected(client: TestClient, partial_report_id: str):
    """Empty or whitespace-only description answers are rejected with 400 Bad Request."""
    payload = {
        "answers": [
            {"question_id": "description", "value": "   "}
        ]
    }
    res = client.post(f"/api/v1/reports/{partial_report_id}/evidence-interview/answers", json=payload)
    assert res.status_code == 400
    assert "at least 3 non-whitespace characters" in res.json()["detail"]


def test_submit_oversized_description_rejected(client: TestClient, partial_report_id: str):
    """Description answer exceeding 5000 characters is rejected by schema validation."""
    payload = {
        "answers": [
            {"question_id": "description", "value": "A" * 5001}
        ]
    }
    res = client.post(f"/api/v1/reports/{partial_report_id}/evidence-interview/answers", json=payload)
    assert res.status_code in [400, 422]


def test_protected_fields_cannot_be_modified(client: TestClient, partial_report_id: str):
    """Extra or protected fields in the payload are rejected by strict Pydantic validation."""
    payload = {
        "answers": [
            {"question_id": "flow_condition", "value": "flowing", "status": "VERIFIED"}
        ]
    }
    res = client.post(f"/api/v1/reports/{partial_report_id}/evidence-interview/answers", json=payload)
    assert res.status_code == 422


def test_recalculation_after_answering_removes_question_from_next_interview(client: TestClient, partial_report_id: str):
    """
    After answering a missing field, the next GET interview request reflects the updated state
    and no longer asks about the answered dimension.
    """
    # 1. Initial interview has water_appearance and flow_condition
    initial_q = client.get(f"/api/v1/reports/{partial_report_id}/evidence-interview").json()
    assert [q["question_id"] for q in initial_q["questions"]] == ["water_appearance", "flow_condition"]

    # 2. Citizen answers water_appearance
    answer_res = client.post(
        f"/api/v1/reports/{partial_report_id}/evidence-interview/answers",
        json={"answers": [{"question_id": "water_appearance", "value": "cloudy"}]},
    )
    assert answer_res.status_code == 200

    # 3. Next interview now asks about flow_condition and odor (water_appearance is resolved)
    next_q = client.get(f"/api/v1/reports/{partial_report_id}/evidence-interview").json()
    assert [q["question_id"] for q in next_q["questions"]] == ["flow_condition", "odor"]

    # 4. Citizen answers flow_condition and odor
    final_answer = client.post(
        f"/api/v1/reports/{partial_report_id}/evidence-interview/answers",
        json={
            "answers": [
                {"question_id": "flow_condition", "value": "flowing"},
                {"question_id": "odor", "value": "none_noticed"},
            ]
        },
    )
    assert final_answer.status_code == 200
    assert final_answer.json()["evidence_quality"]["quality"] == "COMPLETE"
    assert final_answer.json()["evidence_quality"]["score"] == 1.0

    # 5. Subsequent interview returns 0 questions
    final_q = client.get(f"/api/v1/reports/{partial_report_id}/evidence-interview").json()
    assert final_q["questions"] == []
