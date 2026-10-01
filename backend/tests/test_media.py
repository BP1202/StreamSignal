import io
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.models.media import ReportMedia
from app.services.storage import get_storage


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def create_test_image_bytes(fmt: str = "JPEG", size: tuple = (50, 50), color: tuple = (0, 150, 0)) -> bytes:
    """Helper to generate valid in-memory image bytes."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=fmt)
    return buf.getvalue()


@pytest.fixture
def created_report_id(client: TestClient) -> str:
    """Create a sample report for media attachment tests."""
    payload = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "latitude": 23.0225,
        "longitude": 72.5714,
        "description": "Stream observation for citizen media attachment testing.",
    }
    res = client.post("/api/v1/reports", json=payload)
    assert res.status_code == 201
    return res.json()["id"]


def test_upload_valid_image_success(client: TestClient, created_report_id: str, db):
    """A valid JPEG image upload attaches to report, saves to disk, and stores DB metadata."""
    img_bytes = create_test_image_bytes(fmt="JPEG")
    expected_sha256 = hashlib.sha256(img_bytes).hexdigest()

    files = {"file": ("algae_sample.jpg", img_bytes, "image/jpeg")}
    res = client.post(f"/api/v1/reports/{created_report_id}/media", files=files)

    assert res.status_code == 201
    data = res.json()

    media_id = data["id"]
    assert data["report_id"] == created_report_id
    assert data["original_filename"] == "algae_sample.jpg"
    assert data["content_type"] == "image/jpeg"
    assert data["size_bytes"] == len(img_bytes)
    assert data["sha256"] == expected_sha256
    assert "created_at" in data

    # Verify database persistence
    db_media = db.query(ReportMedia).filter(ReportMedia.id == media_id).first()
    assert db_media is not None
    assert db_media.sha256 == expected_sha256
    assert str(db_media.report_id) == created_report_id

    # Verify physical file existence in storage backend
    storage = get_storage()
    assert storage.exists(db_media.storage_key)
    file_path = storage.get_path(db_media.storage_key)
    assert file_path.read_bytes() == img_bytes


def test_upload_valid_png_and_webp(client: TestClient, created_report_id: str):
    """PNG and WebP formats are accepted and assigned correct MIME types."""
    # Test PNG
    png_bytes = create_test_image_bytes(fmt="PNG")
    res_png = client.post(
        f"/api/v1/reports/{created_report_id}/media",
        files={"file": ("stream.png", png_bytes, "image/png")},
    )
    assert res_png.status_code == 201
    assert res_png.json()["content_type"] == "image/png"

    # Test WebP
    webp_bytes = create_test_image_bytes(fmt="WEBP")
    res_webp = client.post(
        f"/api/v1/reports/{created_report_id}/media",
        files={"file": ("stream.webp", webp_bytes, "image/webp")},
    )
    assert res_webp.status_code == 201
    assert res_webp.json()["content_type"] == "image/webp"


def test_upload_missing_report(client: TestClient):
    """Uploading media to a non-existent report UUID returns 404 Not Found."""
    random_id = str(uuid.uuid4())
    img_bytes = create_test_image_bytes(fmt="JPEG")
    files = {"file": ("test.jpg", img_bytes, "image/jpeg")}

    res = client.post(f"/api/v1/reports/{random_id}/media", files=files)
    assert res.status_code == 404
    assert f"Report with id '{random_id}' not found" in res.json()["detail"]


def test_upload_invalid_uuid(client: TestClient):
    """Uploading media with invalid UUID format in path returns 422 Unprocessable Entity."""
    img_bytes = create_test_image_bytes(fmt="JPEG")
    files = {"file": ("test.jpg", img_bytes, "image/jpeg")}

    res = client.post("/api/v1/reports/not-a-uuid/media", files=files)
    assert res.status_code == 422


def test_upload_unsupported_format(client: TestClient, created_report_id: str):
    """Uploading a clearly non-image file (.txt / .exe) is rejected with 400 Bad Request."""
    dummy_text = b"This is a plain text file, not an image observation."
    files = {"file": ("evidence.txt", dummy_text, "text/plain")}

    res = client.post(f"/api/v1/reports/{created_report_id}/media", files=files)
    assert res.status_code == 400
    assert "Corrupt or invalid image payload" in res.json()["detail"] or "Unsupported" in res.json()["detail"]


def test_upload_mime_spoofing(client: TestClient, created_report_id: str):
    """MIME spoofing (sending arbitrary non-image text with Content-Type: image/jpeg) is rejected."""
    malicious_payload = b"<html><script>alert('xss')</script></html>"
    files = {"file": ("innocent.jpg", malicious_payload, "image/jpeg")}

    res = client.post(f"/api/v1/reports/{created_report_id}/media", files=files)
    assert res.status_code == 400
    assert "Corrupt or invalid image payload" in res.json()["detail"]


def test_upload_corrupt_truncated_image(client: TestClient, created_report_id: str):
    """Truncated or corrupted image payload is rejected by decode verification."""
    valid_bytes = create_test_image_bytes(fmt="JPEG")
    corrupt_bytes = valid_bytes[:20]  # Only header slice

    files = {"file": ("broken.jpg", corrupt_bytes, "image/jpeg")}
    res = client.post(f"/api/v1/reports/{created_report_id}/media", files=files)
    assert res.status_code == 400
    assert "Corrupt or invalid image payload" in res.json()["detail"]


def test_upload_oversized_image(client: TestClient, created_report_id: str):
    """Uploading an image larger than maximum allowed size (10MB) is rejected."""
    # Mock settings.MAX_UPLOAD_SIZE_BYTES to 1000 bytes for fast deterministic test
    with patch("app.services.media.get_settings") as mock_settings:
        from app.core.config import get_settings
        real = get_settings()
        mock_settings.return_value = real.model_copy(update={"MAX_UPLOAD_SIZE_BYTES": 1000})

        img_bytes = create_test_image_bytes(fmt="JPEG", size=(200, 200))
        assert len(img_bytes) > 1000

        files = {"file": ("big.jpg", img_bytes, "image/jpeg")}
        res = client.post(f"/api/v1/reports/{created_report_id}/media", files=files)
        assert res.status_code == 400
        assert "exceeds maximum allowed limit" in res.json()["detail"]


def test_dangerous_path_traversal_filename(client: TestClient, created_report_id: str):
    """
    Malicious client filenames containing traversal components (e.g. ../../evil.jpg)
    are strictly neutralized. The stored file stays inside the configured storage root.
    """
    img_bytes = create_test_image_bytes(fmt="JPEG")
    dangerous_names = [
        "../../evil.jpg",
        r"..\..\evil.jpg",
        "C:\\Windows\\System32\\calc.exe",
        "/etc/passwd.jpg",
        "photo\x00<script>.jpg",
    ]

    storage = get_storage()

    for dangerous_name in dangerous_names:
        files = {"file": (dangerous_name, img_bytes, "image/jpeg")}
        res = client.post(f"/api/v1/reports/{created_report_id}/media", files=files)
        assert res.status_code == 201
        data = res.json()

        # Check metadata original_filename does not contain path traversal directory slashes
        assert "/" not in data["original_filename"]
        assert "\\" not in data["original_filename"]

        # Check stored file remains strictly within storage base directory
        storage_key = f"reports/{created_report_id}/media/{data['id']}.jpg"
        resolved_path = storage.get_path(storage_key)
        assert resolved_path.is_relative_to(storage.base_dir)
        assert resolved_path.is_file()


def test_multiple_media_for_single_report(client: TestClient, created_report_id: str, db):
    """Multiple images can be uploaded and attached to the same observation report."""
    img1 = create_test_image_bytes(fmt="JPEG", color=(255, 0, 0))
    img2 = create_test_image_bytes(fmt="PNG", color=(0, 0, 255))

    res1 = client.post(
        f"/api/v1/reports/{created_report_id}/media",
        files={"file": ("view_1.jpg", img1, "image/jpeg")},
    )
    res2 = client.post(
        f"/api/v1/reports/{created_report_id}/media",
        files={"file": ("view_2.png", img2, "image/png")},
    )

    assert res1.status_code == 201
    assert res2.status_code == 201

    id1 = res1.json()["id"]
    id2 = res2.json()["id"]
    assert id1 != id2

    media_records = (
        db.query(ReportMedia)
        .filter(ReportMedia.report_id == created_report_id)
        .all()
    )
    stored_ids = {str(m.id) for m in media_records}
    assert id1 in stored_ids
    assert id2 in stored_ids


def test_storage_rollback_on_database_failure(client: TestClient, created_report_id: str):
    """
    If database insertion fails, the stored file on disk must be cleaned up
    so that no orphaned media files are left on the filesystem.
    """
    img_bytes = create_test_image_bytes(fmt="JPEG")
    files = {"file": ("orphan_test.jpg", img_bytes, "image/jpeg")}

    storage = get_storage()

    # Simulate database commit error
    with patch("sqlalchemy.orm.Session.commit", side_effect=RuntimeError("Simulated DB Failure")):
        with pytest.raises(RuntimeError):
            client.post(f"/api/v1/reports/{created_report_id}/media", files=files)

    # Check that any generated file during the failed attempt was cleaned up
    # (storage.exists for any orphaned file should be False)
