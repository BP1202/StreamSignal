from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, ConfigDict


class ReportBase(BaseModel):
    """Shared fields for report representation and common attributes."""
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90 degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude between -180 and 180 degrees")
    description: str = Field(..., min_length=3, max_length=5000, description="Detailed description of observation")
    observed_at: datetime = Field(..., description="Timestamp of when observation occurred")
    water_appearance: Optional[str] = Field(default=None, max_length=100, description="Visual description of water")
    odor: Optional[str] = Field(default=None, max_length=100, description="Smell or odor observed")
    flow_condition: Optional[str] = Field(default=None, max_length=50, description="Flow rate or stagnation state")
    foam_observed: bool = Field(default=False, description="Whether unnatural foam was observed")
    litter_observed: bool = Field(default=False, description="Whether visible trash/debris was present")
    dead_wildlife_observed: bool = Field(default=False, description="Whether dead fish or aquatic life were seen")

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 3:
            raise ValueError("Description must contain at least 3 non-whitespace characters")
        return cleaned


class ReportCreate(ReportBase):
    """
    Schema for incoming citizen report submissions.
    Strictly forbids client from controlling server-managed fields like id, status, timestamps.
    """
    model_config = ConfigDict(extra="forbid")


class ReportResponse(ReportBase):
    """Schema for returned report instances."""
    id: UUID
    status: str
    observed_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportListResponse(BaseModel):
    """Schema for paginated list of citizen reports."""
    items: List[ReportResponse]
    limit: int
    offset: int
    total: int

    model_config = ConfigDict(from_attributes=True)
