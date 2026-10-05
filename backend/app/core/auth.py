"""OIDC-backed researcher authorization with a development-only role shortcut."""

from functools import lru_cache
from typing import Any, Dict, Optional

import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, PyJWKClientError
from fastapi import Header, HTTPException, status

from app.core.config import Settings, get_settings


@lru_cache(maxsize=8)
def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_keys=True)


def _unauthorized(detail: str = "A valid researcher access token is required.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_access_token(token: str, settings: Settings) -> Dict[str, Any]:
    if not settings.OIDC_ISSUER or not settings.OIDC_AUDIENCE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Research authentication is not configured.",
        )

    jwks_url = settings.OIDC_JWKS_URL or f"{settings.OIDC_ISSUER.rstrip('/')}/.well-known/jwks.json"
    try:
        signing_key = _get_jwks_client(jwks_url).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.OIDC_AUDIENCE,
            issuer=settings.OIDC_ISSUER,
            options={"require": ["exp", "iat", "sub"]},
        )
    except (InvalidTokenError, PyJWKClientError, ValueError):
        raise _unauthorized()


def _has_researcher_role(claims: Dict[str, Any], settings: Settings) -> bool:
    roles = claims.get(settings.OIDC_ROLE_CLAIM)
    if isinstance(roles, str):
        roles = [roles]
    return isinstance(roles, list) and settings.OIDC_RESEARCHER_ROLE in roles


def get_oidc_subject(authorization: Optional[str]) -> Optional[str]:
    """Validate an optional bearer access token and return its stable subject."""
    if not authorization:
        return None
    if not authorization.lower().startswith("bearer "):
        raise _unauthorized()
    claims = _decode_access_token(authorization.split(" ", 1)[1].strip(), get_settings())
    return str(claims["sub"])


def require_researcher_role(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_role: Optional[str] = Header(None, alias="X-Role"),
) -> str:
    """Require a verified OIDC researcher token; trust X-Role only in development."""
    settings = get_settings()
    if settings.ENVIRONMENT.lower() == "development" and x_role:
        if x_role.upper() == "RESEARCHER":
            return "development-researcher"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: This endpoint requires researcher authorization.",
        )

    if not authorization or not authorization.lower().startswith("bearer "):
        if settings.ENVIRONMENT.lower() == "development":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: This endpoint requires researcher authorization.",
            )
        raise _unauthorized()

    claims = _decode_access_token(authorization.split(" ", 1)[1].strip(), settings)
    if not _has_researcher_role(claims, settings):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: This endpoint requires the researcher role.",
        )
    return str(claims["sub"])


def require_reviewer_identity(
    x_reviewer_id: Optional[str] = Header(None, alias="X-Reviewer-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> str:
    """
    Dependency that requires an explicit reviewer identity for audit-sensitive operations.

    No default reviewer ID is provided — the caller must supply one.
    This prevents anonymous/default reviewer identities from leaking into production records.
    """
    settings = get_settings()
    if settings.ENVIRONMENT.lower() == "development":
        if x_reviewer_id and x_reviewer_id.strip():
            return x_reviewer_id.strip()
        if authorization and authorization.lower().startswith("bearer "):
            try:
                claims = _decode_access_token(authorization.split(" ", 1)[1].strip(), settings)
                if _has_researcher_role(claims, settings) and claims.get("sub"):
                    return str(claims["sub"])
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="X-Reviewer-Id header is required for review operations. No default reviewer identity is permitted.",
        )

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A verified reviewer identity is required for review operations.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = _decode_access_token(authorization.split(" ", 1)[1].strip(), settings)
    if not _has_researcher_role(claims, settings):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: This operation requires the researcher role.",
        )
    return str(claims["sub"])
