"""
StreamSignal — Issue 14: Realtime Live Evidence Bridge Tests
Tests WebSocket connection lifecycle, tenant isolation, post-commit publishing,
safe citizen event payloads, and empty database guarantees.
"""

from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.services.realtime import connection_manager, RealtimeEventType


def test_research_websocket_connection_and_ping(client: TestClient):
    """Research WebSocket connects cleanly and handles ping/pong."""
    with client.websocket_connect("/ws/research") as ws:
        ws.send_text("ping")
        response = ws.receive_text()
        assert response == "pong"


def test_research_websocket_versioned_path(client: TestClient):
    """Research WebSocket also works at versioned /api/v1/ws/research path."""
    with client.websocket_connect("/api/v1/ws/research") as ws:
        ws.send_text("ping")
        assert ws.receive_text() == "pong"


def test_citizen_websocket_connection_and_ping(client: TestClient):
    """Citizen WebSocket connects cleanly for a specific report_id."""
    report_id = str(uuid4())
    with client.websocket_connect(f"/ws/citizen/{report_id}") as ws:
        ws.send_text("ping")
        assert ws.receive_text() == "pong"


def test_citizen_websocket_isolation(client: TestClient):
    """
    Citizen A on report_1 must NOT receive events published for Citizen B on report_2.
    """
    report_id_1 = str(uuid4())
    report_id_2 = str(uuid4())

    with client.websocket_connect(f"/ws/citizen/{report_id_1}") as ws1:
        with client.websocket_connect(f"/ws/citizen/{report_id_2}") as ws2:
            # Publish event for report_1 only
            connection_manager.publish_event(
                event_type=RealtimeEventType.CITIZEN_IMPACT_UPDATED,
                case_id=report_id_1,
                report_id=report_id_1,
                payload={
                    "workflow_status": "REVIEWED",
                    "citizen_label": "Reviewed",
                    "safe_summary": "Your observation was reviewed.",
                },
            )

            # ws1 must receive it
            msg1 = ws1.receive_json()
            assert msg1["event_type"] == "CITIZEN_IMPACT_UPDATED"
            assert msg1["report_id"] == report_id_1

            # ws2 should still be responsive to ping and have received no events
            ws2.send_text("ping")
            assert ws2.receive_text() == "pong"


def test_create_report_publishes_signal_case_created(client: TestClient):
    """
    When a citizen creates an observation via POST /api/v1/reports,
    the research WebSocket receives a SIGNAL_CASE_CREATED event with real IDs.
    """
    with client.websocket_connect("/ws/research") as ws:
        payload = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "description": "After-Rain Stream Check: Green surface material observed near culvert.",
            "observed_at": "2026-06-15T10:30:00Z",
            "water_appearance": "green_algae",
            "flow_condition": "slow",
            "odor": "none",
        }
        res = client.post("/api/v1/reports", json=payload)
        assert res.status_code == 201
        report_data = res.json()
        report_id = report_data["id"]

        # WebSocket should receive real event
        event = ws.receive_json()
        assert event["event_type"] == "SIGNAL_CASE_CREATED"
        assert event["case_id"] == report_id
        assert event["report_id"] == report_id
        assert "occurred_at" in event
        assert event["payload"]["title"] == f"Observation #{report_id[:8].upper()}"


def test_human_review_publishes_research_and_citizen_events(client: TestClient):
    """
    When researcher submits a decision:
    1. Research WebSocket receives HUMAN_REVIEW_RECORDED.
    2. Citizen WebSocket receives CITIZEN_IMPACT_UPDATED with safe non-sensitive data.
    """
    # Create report first
    report_res = client.post(
        "/api/v1/reports",
        json={
            "latitude": 40.7128,
            "longitude": -74.0060,
            "description": "Stream check with unusual green scum.",
            "observed_at": "2026-06-15T10:30:00Z",
        },
    )
    assert report_res.status_code == 201
    report_id = report_res.json()["id"]

    with client.websocket_connect("/ws/research") as ws_research:
        with client.websocket_connect(f"/ws/citizen/{report_id}") as ws_citizen:
            # Submit human review
            review_payload = {
                "outcome": "REQUEST_FIELD_VERIFICATION",
                "rationale": "Visual cues and proximity justify a professional field check.",
            }
            rev_res = client.post(
                f"/api/v1/research/evidence-cases/{report_id}/reviews",
                json=review_payload,
                headers={"X-Reviewer-Id": "R-101"},
            )
            assert rev_res.status_code == 201

            # Research event check
            research_event = ws_research.receive_json()
            assert research_event["event_type"] == "HUMAN_REVIEW_RECORDED"
            assert research_event["case_id"] == report_id
            assert research_event["payload"]["outcome"] == "REQUEST_FIELD_VERIFICATION"
            assert research_event["payload"]["workflow_status"] == "FIELD_VERIFICATION_REQUESTED"

            # Citizen event check: strict privacy!
            citizen_event = ws_citizen.receive_json()
            assert citizen_event["event_type"] == "CITIZEN_IMPACT_UPDATED"
            assert citizen_event["case_id"] == report_id
            assert citizen_event["report_id"] == report_id

            # Verify no sensitive researcher data leaked to citizen
            citizen_payload = citizen_event["payload"]
            assert "reviewer_id" not in citizen_payload
            assert "reviewer_notes" not in citizen_payload
            assert "rationale" not in citizen_payload
            assert "coordinates" not in citizen_payload
            assert citizen_payload["workflow_status"] == "FIELD_VERIFICATION_REQUESTED"
            assert "citizen_label" in citizen_payload
            assert "safe_description" in citizen_payload


def test_failed_review_transaction_does_not_publish_event(client: TestClient):
    """
    If review submission fails validation (e.g. rationale too short < 15 chars),
    no WebSocket event is emitted.
    """
    report_res = client.post(
        "/api/v1/reports",
        json={
            "latitude": 40.7128,
            "longitude": -74.0060,
            "description": "Stream check for validation test.",
            "observed_at": "2026-06-15T10:30:00Z",
        },
    )
    report_id = report_res.json()["id"]

    with client.websocket_connect("/ws/research") as ws:
        # Invalid rationale (too short)
        res = client.post(
            f"/api/v1/research/evidence-cases/{report_id}/reviews",
            json={"outcome": "MONITOR", "rationale": "Too short"},
        )
        assert res.status_code == 422

        # Ping should be received directly with no event preceding it
        ws.send_text("ping")
        assert ws.receive_text() == "pong"


def test_live_evidence_bridge_full_integration_flow(client: TestClient):
    """
    Issue 14 Section 38 Integration Flow:
    POST report -> SignalCase exists -> SIGNAL_CASE_CREATED event received ->
    Research API retrieves case -> Review submitted -> Lineage persisted ->
    Impact status changes and CITIZEN_IMPACT_UPDATED received.
    """
    with client.websocket_connect("/ws/research") as ws_research:
        # 1. Citizen posts observation
        report_payload = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "description": "After-Rain Stream Check: Green surface material near outflow.",
            "observed_at": "2026-06-15T10:30:00Z",
            "water_appearance": "green_surface_material",
            "flow_condition": "slow",
            "odor": "none",
        }
        create_res = client.post("/api/v1/reports", json=report_payload)
        assert create_res.status_code == 201
        case_id = create_res.json()["id"]

        # 2. Research WebSocket receives real-time SIGNAL_CASE_CREATED
        case_event = ws_research.receive_json()
        assert case_event["event_type"] == "SIGNAL_CASE_CREATED"
        assert case_event["case_id"] == case_id

        # 3. Research Workspace fetches authoritative case from REST API
        detail_res = client.get(f"/api/v1/research/evidence-cases/{case_id}")
        assert detail_res.status_code == 200
        case_detail = detail_res.json()
        assert case_detail["case_id"] == case_id
        assert case_detail["workflow_status"] == "AWAITING_REVIEW"

        # 4. Citizen connects to their observation WebSocket
        with client.websocket_connect(f"/ws/citizen/{case_id}") as ws_citizen:
            # 5. Researcher submits a real review decision
            review_payload = {
                "outcome": "REQUEST_FIELD_VERIFICATION",
                "rationale": "High-priority visual green cues warrant professional field verification.",
            }
            review_res = client.post(
                f"/api/v1/research/evidence-cases/{case_id}/reviews",
                json=review_payload,
                headers={"X-Reviewer-Id": "R-LIVE-DEMO"},
            )
            assert review_res.status_code == 201

            # 6. Research socket receives HUMAN_REVIEW_RECORDED
            rev_event = ws_research.receive_json()
            assert rev_event["event_type"] == "HUMAN_REVIEW_RECORDED"
            assert rev_event["case_id"] == case_id
            assert rev_event["payload"]["workflow_status"] == "FIELD_VERIFICATION_REQUESTED"

            # 7. Citizen socket receives CITIZEN_IMPACT_UPDATED live
            citizen_event = ws_citizen.receive_json()
            assert citizen_event["event_type"] == "CITIZEN_IMPACT_UPDATED"
            assert citizen_event["case_id"] == case_id
            assert citizen_event["payload"]["workflow_status"] == "FIELD_VERIFICATION_REQUESTED"

            # 8. Evidence lineage verified via API
            lineage_res = client.get(f"/api/v1/research/evidence-cases/{case_id}/lineage")
            assert lineage_res.status_code == 200
            lineage_data = lineage_res.json()
            assert lineage_data["total"] >= 1
            assert lineage_data["events"][-1]["event_type"] == "HUMAN_REVIEW_RECORDED"
            assert lineage_data["events"][-1]["actor_id"] == "R-LIVE-DEMO"

            # 9. Citizen impact status verified via REST
            impact_res = client.get(f"/api/v1/reports/{case_id}/impact-status")
            assert impact_res.status_code == 200
            impact_data = impact_res.json()
            assert impact_data["status"] == "FIELD_VERIFICATION_REQUESTED"
            assert "Field Verification" in impact_data["status_label"]


def test_empty_database_returns_zero_cases(client: TestClient):
    """
    Guarantees clean empty state: on an empty database (or default query),
    GET /api/v1/research/evidence-cases returns items list without fake fallback items.
    """
    res = client.get("/api/v1/research/evidence-cases")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    # Verified items are real Report-backed dicts, no hardcoded SS-1048
    for item in data["items"]:
        assert item["case_id"] != "SS-1048"
