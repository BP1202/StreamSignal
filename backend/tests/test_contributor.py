"""
Tests for Contributor Identity Service & Endpoints
Validates persistent anonymous handles, ID retention, and in-place account upgrades.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.contributor import Contributor
from app.services.contributor import (
    get_or_create_contributor,
    upgrade_contributor_account,
)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_get_or_create_anonymous_contributor(db_session: Session):
    """
    Creating a new contributor generates a pseudonymous handle (e.g. RiverHeron-4821)
    and an SS-C-XXXX public contributor ID at LEVEL_1_CONTRIBUTOR.
    """
    contributor = get_or_create_contributor(db=db_session, contributor_id_str=None)
    assert contributor is not None
    assert contributor.id is not None
    assert contributor.contributor_id.startswith("SS-C-")
    assert contributor.account_level == "LEVEL_1_CONTRIBUTOR"
    assert contributor.display_name != ""
    assert contributor.email is None

    # Clean up
    db_session.delete(contributor)
    db_session.commit()


def test_contributor_retention_via_id_str(db_session: Session):
    """
    Passing an existing contributor_id retains the exact same record without duplication.
    """
    c1 = get_or_create_contributor(db=db_session, contributor_id_str=None)
    c1_id = str(c1.id)
    c1_code = c1.contributor_id

    c2 = get_or_create_contributor(db=db_session, contributor_id_str=c1_code)
    assert str(c2.id) == c1_id
    assert c2.contributor_id == c1_code
    assert c2.display_name == c1.display_name

    # Clean up
    db_session.delete(c1)
    db_session.commit()


def test_contributor_account_upgrade(db_session: Session):
    """
    Upgrading account level from 1 to 2 attaches an email and password
    while strictly preserving the original UUID and contributor_id.
    """
    c = get_or_create_contributor(db=db_session, contributor_id_str=None)
    original_id = c.id
    original_code = c.contributor_id

    updated = upgrade_contributor_account(
        db=db_session,
        contributor_id_str=c.contributor_id,
        email="citizen@oneaquahealth.org",
        password="SecurePassword123!",
    )

    assert updated.id == original_id
    assert updated.contributor_id == original_code
    assert updated.account_level == "LEVEL_2_REGISTERED"
    assert updated.email == "citizen@oneaquahealth.org"

    # Clean up
    db_session.delete(updated)
    db_session.commit()


def test_api_citizen_me_and_upgrade(client: TestClient, db_session: Session):
    """
    Tests GET /api/v1/citizen/me and POST /api/v1/citizen/account/upgrade HTTP endpoints.
    """
    # 1. Fetch anonymous profile without header -> generates new Level 1 identity
    res1 = client.get("/api/v1/citizen/me")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["account_level"] == "LEVEL_1_CONTRIBUTOR"
    assert data1["contributor_id"].startswith("SS-C-")
    code = data1["contributor_id"]

    # 2. Fetch with X-Contributor-Id header -> returns same record
    res2 = client.get("/api/v1/citizen/me", headers={"X-Contributor-Id": code})
    assert res2.status_code == 200
    assert res2.json()["id"] == data1["id"]

    # 3. Upgrade account to Level 2
    upgrade_payload = {
        "email": "scout@citystream.org",
        "password": "StrongPassword99!",
    }
    res3 = client.post(
        "/api/v1/citizen/account/upgrade",
        json=upgrade_payload,
        headers={"X-Contributor-Id": code},
    )
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["success"] is True
    assert data3["contributor"]["account_level"] == "LEVEL_2_REGISTERED"
    assert data3["contributor"]["email"] == "scout@citystream.org"

    # Clean up created record
    db_session.query(Contributor).filter(Contributor.contributor_id == code).delete()
    db_session.commit()
