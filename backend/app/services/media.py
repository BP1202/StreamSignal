import io
import hashlib
import uuid
import re
from pathlib import Path
from typing import Optional, Tuple
from uuid import UUID
from PIL import Image
from PIL.Image import DecompressionBombError, DecompressionBombWarning
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.media import ReportMedia
from app.models.report import Report
from app.services.storage import StorageBackend, get_storage

# Standard MIME types and file extensions for allowed image formats
FORMAT_MAP = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}


def sanitize_filename(filename: Optional[str]) -> str:
    """
    Sanitize client-provided filename for safe metadata storage.
    Removes path traversal components, null bytes, and control characters.
    The filename is stored purely as descriptive metadata and never dictates
    storage location or filesystem paths.
    """
    if not filename:
        return "unnamed_evidence"

    # Strip any directory path components (both POSIX and Windows)
    basename = Path(filename.replace("\\", "/")).name

    # Remove null bytes, control characters, and non-printable characters
    cleaned = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", basename).strip()

    # Fallback if filename became empty after cleaning
    if not cleaned:
        return "unnamed_evidence"

    # Cap length to 255 characters
    return cleaned[:255]


def validate_and_decode_image(data: bytes) -> Tuple[str, str, str]:
    """
    Inspects actual image binary content using Pillow.
    Verifies MIME format allowlist, decodes pixels to ensure payload is not corrupt,
    and enforces decompression-bomb limits to safeguard memory and CPU resources.

    Returns:
        Tuple of (detected_format, content_type, extension)
    """
    settings = get_settings()

    # 1. File size check
    if len(data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    if len(data) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum allowed limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB",
        )

    # 2. Decompression bomb safeguard
    Image.MAX_IMAGE_PIXELS = settings.MAX_IMAGE_PIXELS

    # 3. Content inspection and decode verification
    try:
        # First pass: verify container headers
        with Image.open(io.BytesIO(data)) as img:
            format_detected = img.format
            if format_detected not in settings.ALLOWED_IMAGE_FORMATS:
                allowed_str = ", ".join(settings.ALLOWED_IMAGE_FORMATS)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported image format '{format_detected}'. Allowed formats: {allowed_str}",
                )
            img.verify()

        # Second pass: actually load pixel data to ensure payload is not truncated or corrupt
        with Image.open(io.BytesIO(data)) as decoded:
            decoded.load()

    except HTTPException:
        raise
    except (DecompressionBombError, DecompressionBombWarning):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image exceeds maximum allowable pixel dimensions (resource safety limit)",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupt or invalid image payload",
        )

    content_type, ext = FORMAT_MAP[format_detected]
    return format_detected, content_type, ext


def ingest_report_media(
    report_id: UUID,
    file_bytes: bytes,
    original_filename: Optional[str],
    db: Session,
    storage: Optional[StorageBackend] = None,
) -> ReportMedia:
    """
    Coordinates secure ingestion of citizen visual evidence:
    1. Validates that the linked report exists in PostgreSQL.
    2. Validates actual image content, format allowlist, and integrity.
    3. Calculates SHA-256 cryptographic checksum from actual uploaded bytes.
    4. Generates server-controlled storage key and persists image bytes via storage backend.
    5. Persists metadata record in PostgreSQL.
    6. Ensures consistency: deletes stored file if database commit fails.
    """
    if storage is None:
        storage = get_storage()

    # 1. Verify parent report existence
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{report_id}' not found",
        )

    # 2. Content validation & decode verification
    _, content_type, ext = validate_and_decode_image(file_bytes)

    # 3. Cryptographic checksum
    sha256_checksum = hashlib.sha256(file_bytes).hexdigest()

    # 4. Generate safe server-controlled storage key
    media_id = uuid.uuid4()
    storage_key = f"reports/{report_id}/media/{media_id}{ext}"
    sanitized_name = sanitize_filename(original_filename)

    # 5. Store image bytes
    storage.save(storage_key, file_bytes)

    # 6. Persist metadata in database with orphan cleanup on failure
    db_media = ReportMedia(
        id=media_id,
        report_id=report_id,
        storage_key=storage_key,
        original_filename=sanitized_name,
        content_type=content_type,
        size_bytes=len(file_bytes),
        sha256=sha256_checksum,
    )

    try:
        db.add(db_media)
        db.commit()
        db.refresh(db_media)
        return db_media
    except Exception:
        db.rollback()
        # Clean up stored bytes so no orphaned file is left
        storage.delete(storage_key)
        raise
