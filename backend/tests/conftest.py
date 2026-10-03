from typing import Generator
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    """
    Reusable FastAPI test client fixture.
    Runs with lifespan context management enabled.
    """
    with TestClient(app) as test_client:
        yield test_client


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
    from app.models.contributor import Contributor
    from app.models.report import Report

    db = SessionLocal()
    try:
        db.query(AgentActionAudit).delete()
        db.query(Mission).delete()
        db.query(Contributor).delete()
        db.query(EvidenceLineageEvent).delete()
        db.query(HumanReview).delete()
        db.query(ReportMedia).delete()
        db.query(Report).delete()
        db.commit()
    finally:
        db.close()

