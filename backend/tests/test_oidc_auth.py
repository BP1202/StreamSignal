"""OIDC JWT validation and researcher role enforcement tests."""

from types import SimpleNamespace
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.core import auth
from app.core.config import get_settings


@pytest.fixture
def oidc_keys(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    settings = get_settings().model_copy(
        update={
            "ENVIRONMENT": "production",
            "OIDC_ISSUER": "https://streamsignal.test/",
            "OIDC_AUDIENCE": "https://api.streamsignal.test",
            "OIDC_JWKS_URL": "https://streamsignal.test/.well-known/jwks.json",
            "OIDC_ROLE_CLAIM": "https://streamsignal.app/roles",
            "OIDC_RESEARCHER_ROLE": "RESEARCHER",
        }
    )
    monkeypatch.setattr(auth, "get_settings", lambda: settings)
    monkeypatch.setattr(
        auth,
        "_get_jwks_client",
        lambda _url: SimpleNamespace(
            get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=public_key)
        ),
    )

    def token(**overrides):
        claims = {
            "iss": settings.OIDC_ISSUER,
            "aud": settings.OIDC_AUDIENCE,
            "sub": "auth0|researcher-123",
            "iat": int(time.time()) - 60,
            "exp": int(time.time()) + 600,
            settings.OIDC_ROLE_CLAIM: ["RESEARCHER"],
        }
        claims.update(overrides)
        return jwt.encode(claims, private_key, algorithm="RS256")

    return settings, token


def test_researcher_token_is_signature_issuer_audience_and_role_validated(oidc_keys):
    _, token = oidc_keys
    reviewer = auth.require_researcher_role(
        authorization=f"Bearer {token()}",
        x_role="CITIZEN",
    )
    assert reviewer == "auth0|researcher-123"


def test_forged_role_header_does_not_authorize_production(oidc_keys):
    with pytest.raises(HTTPException) as exc:
        auth.require_researcher_role(authorization=None, x_role="RESEARCHER")
    assert exc.value.status_code == 401


def test_non_researcher_token_is_forbidden(oidc_keys):
    _, token = oidc_keys
    claims = {"https://streamsignal.app/roles": ["CITIZEN"]}
    with pytest.raises(HTTPException) as exc:
        auth.require_researcher_role(authorization=f"Bearer {token(**claims)}", x_role=None)
    assert exc.value.status_code == 403


def test_wrong_audience_token_is_unauthorized(oidc_keys):
    _, token = oidc_keys
    with pytest.raises(HTTPException) as exc:
        auth.require_researcher_role(
            authorization=f"Bearer {token(aud='https://other.example/api')}",
            x_role=None,
        )
    assert exc.value.status_code == 401


def test_expired_token_is_unauthorized(oidc_keys):
    _, token = oidc_keys
    with pytest.raises(HTTPException) as exc:
        auth.require_researcher_role(
            authorization=f"Bearer {token(exp=1)}",
            x_role=None,
        )
    assert exc.value.status_code == 401


def test_production_without_oidc_configuration_fails_closed(monkeypatch):
    settings = get_settings().model_copy(update={"ENVIRONMENT": "production", "OIDC_ISSUER": "", "OIDC_AUDIENCE": ""})
    monkeypatch.setattr(auth, "get_settings", lambda: settings)
    monkeypatch.setattr(
        auth,
        "_get_jwks_client",
        lambda _url: SimpleNamespace(get_signing_key_from_jwt=lambda _token: SimpleNamespace(key="key")),
    )
    token = "untrusted"
    with pytest.raises(HTTPException) as exc:
        auth.require_researcher_role(authorization=f"Bearer {token}", x_role="RESEARCHER")
    assert exc.value.status_code == 503
