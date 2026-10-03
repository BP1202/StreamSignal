from typing import Generator
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.main import app
from app.models.report import Report


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    """
    Reusable FastAPI test client fixture.
    Runs with lifespan context management enabled.
    """
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def sync_test_db() -> Generator[Session, None, None]:
    """
    Provides a real synchronous SQLAlchemy session against the development PostgreSQL.
    Tests that use this fixture are responsible for deleting their own records.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def test_report_factory(sync_test_db):
    """
    Factory fixture to produce transient Report objects with controllable fields.
    The caller is responsible for cleanup (delete + commit).
    """
    def _factory(
        flow_condition=None,
        water_appearance=None,
        odor=None,
        foam_observed=False,
        dead_wildlife_observed=False,
        description="Issue 17 test report",
        latitude=1.234,
        longitude=103.567,
    ) -> Report:
        return Report(
            observed_at=datetime.now(timezone.utc),
            latitude=latitude,
            longitude=longitude,
            description=description,
            water_appearance=water_appearance,
            odor=odor,
            flow_condition=flow_condition,
            foam_observed=foam_observed,
            dead_wildlife_observed=dead_wildlife_observed,
            status="SUBMITTED",
        )

    return _factory


@pytest.fixture(scope="session", autouse=True)
def cleanup_database_after_tests():
    """
    Session-level teardown ensuring tests never leak test records
    into the development/demo database.
    """
    yield
    from app.core.database import SessionLocal
    from app.models.evidence_lineage import EvidenceLineageEvent
    from app.models.human_review import HumanReview
    from app.models.media import ReportMedia
    from app.models.mission import AgentActionAudit, Mission
    from app.models.mission_need import MissionNeed
    from app.models.contributor import Contributor
    from app.models.report import Report

    db = SessionLocal()
    try:
        db.query(AgentActionAudit).delete()
        db.query(Mission).delete()
        db.query(MissionNeed).delete()
        db.query(Contributor).delete()
        db.query(EvidenceLineageEvent).delete()
        db.query(HumanReview).delete()
        db.query(ReportMedia).delete()
        db.query(Report).delete()
        db.commit()
    finally:
        db.close()
