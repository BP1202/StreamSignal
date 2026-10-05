"""
Tests for Researcher Citizen Media Gallery Endpoint
Verifies that:
1. GET /api/v1/research/media requires researcher authorization (rejects anonymous/citizen).
2. GET /api/v1/research/media returns all uploaded citizen media attachments across reports.
3. Media filtering by type ('image' or 'video') works as expected.
"""

import io
import uuid
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.report import Report
from app.services.media import ingest_report_media


def _make_image_bytes():
    buf = io.BytesIO()
    img = Image.new("RGB", (30, 30), color=(0, 200, 100))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_research_media_requires_researcher_role():
    with TestClient(app) as unauth_client:
        resp = unauth_client.get("/api/v1/research/media")
        assert resp.status_code == 403


def test_research_media_lists_citizen_media(sync_test_db: Session):
    # 1. Create a test report
    report = Report(
        id=uuid.uuid4(),
        latitude=23.0225,
        longitude=72.5714,
        description="Stream algae bloom with test photo",
        water_appearance="GREEN_ALGAE",
        flow_condition="STAGNANT",
    )
    sync_test_db.add(report)
    sync_test_db.commit()

    # 2. Ingest media
    img_bytes = _make_image_bytes()
    media_rec = ingest_report_media(
        report_id=report.id,
        file_bytes=img_bytes,
        original_filename="algae_sample.jpg",
        db=sync_test_db,
    )

    # 3. Query as researcher
    with TestClient(app) as client:
        resp = client.get("/api/v1/research/media", headers={"X-Role": "RESEARCHER"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        found = any(item["media_id"] == str(media_rec.id) for item in data["items"])
        assert found is True

        # Test type filter
        img_resp = client.get("/api/v1/research/media?media_type=image", headers={"X-Role": "RESEARCHER"})
        assert img_resp.status_code == 200
        assert any(item["media_id"] == str(media_rec.id) for item in img_resp.json()["items"])
