from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class ReportMediaResponse(BaseModel):
    """
    Schema for citizen evidence media metadata.
    Exposes content integrity and descriptive metadata while keeping storage paths internal.
    """
    id: UUID = Field(..., description="Unique media record identifier")
    report_id: UUID = Field(..., description="UUID of the linked citizen observation report")
    original_filename: str = Field(..., description="Original client-supplied filename (sanitized)")
    content_type: str = Field(..., description="Validated MIME content type (e.g. image/jpeg)")
    size_bytes: int = Field(..., ge=1, description="Size of uploaded image payload in bytes")
    sha256: str = Field(..., min_length=64, max_length=64, description="SHA-256 cryptographic checksum of image content")
    created_at: datetime = Field(..., description="Timestamp when media evidence was ingested")

    model_config = ConfigDict(from_attributes=True)
