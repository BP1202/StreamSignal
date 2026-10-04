"""
StreamSignal — Role-Based Access Control Dependencies

Provides lightweight FastAPI dependencies for enforcing role-based authorization
on researcher and citizen endpoints. Uses header-based role identification
suitable for the current development/production stage.

This is NOT a full authentication system — it enforces role separation so that
citizen requests cannot access researcher-only endpoints and vice versa.
When full authentication (JWT/OAuth) is introduced, these dependencies should
be updated to extract roles from verified tokens.
"""

from typing import Optional
from fastapi import Header, HTTPException, status


def require_researcher_role(
    x_role: Optional[str] = Header(None, alias="X-Role"),
) -> str:
    """
    Dependency that enforces researcher authorization on protected endpoints.

    Requires the caller to provide `X-Role: RESEARCHER` header.
    Returns 403 Forbidden if the header is missing or has a non-researcher value.

    Usage:
        @router.post("/endpoint", dependencies=[Depends(require_researcher_role)])
    """
    if not x_role or x_role.upper() != "RESEARCHER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: This endpoint requires researcher authorization. Provide 'X-Role: RESEARCHER' header.",
        )
    return x_role


def require_reviewer_identity(
    x_reviewer_id: Optional[str] = Header(None, alias="X-Reviewer-Id"),
) -> str:
    """
    Dependency that requires an explicit reviewer identity for audit-sensitive operations.

    No default reviewer ID is provided — the caller must supply one.
    This prevents anonymous/default reviewer identities from leaking into production records.
    """
    if not x_reviewer_id or not x_reviewer_id.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="X-Reviewer-Id header is required for review operations. No default reviewer identity is permitted.",
        )
    return x_reviewer_id.strip()
