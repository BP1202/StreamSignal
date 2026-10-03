"""
StreamSignal — Contributor Identity Schemas
Supports Level 1 lightweight non-identifying participation
and in-place account upgrade to Level 2 registered accounts.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ContributorResponse(BaseModel):
    id: UUID
    contributor_id: str = Field(..., description="Public non-identifying identifier (e.g. SS-C-4821)")
    display_name: str = Field(..., description="Pseudonymous contributor handle (e.g. RiverHeron-4821)")
    account_level: str = Field(..., description="LEVEL_1_CONTRIBUTOR or LEVEL_2_REGISTERED")
    email: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AccountUpgradeRequest(BaseModel):
    email: str = Field(..., description="Citizen email address for account upgrade")
    password: str = Field(..., min_length=8, max_length=128, description="Account password (min 8 chars)")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if "@" not in trimmed or "." not in trimmed.split("@")[-1]:
            raise ValueError("Invalid email format.")
        return trimmed

    model_config = ConfigDict(extra="forbid")


class AccountUpgradeResponse(BaseModel):
    success: bool = True
    message: str = "Account successfully upgraded to Level 2 Registered Contributor."
    contributor: ContributorResponse
