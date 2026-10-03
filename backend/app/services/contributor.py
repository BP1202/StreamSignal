"""
StreamSignal — Contributor Identity Service
Handles Level 1 non-identifying participation and in-place account upgrades to Level 2.
Zero fake data: all identities are persisted in PostgreSQL.
"""

import hashlib
import os
import random
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.contributor import Contributor

WATERSHED_AVATARS = [
    "RiverHeron",
    "AquaKingfisher",
    "StreamOtter",
    "CreekEgret",
    "WetlandFox",
    "BrookDragonfly",
    "RiparianBeaver",
    "LakeIbiss",
]


def hash_password(password: str) -> str:
    """Standard secure PBKDF2 hash using SHA-256."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return salt.hex() + ":" + key.hex()


def verify_password(stored_password: str, provided_password: str) -> bool:
    try:
        salt_hex, key_hex = stored_password.split(":")
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", provided_password.encode("utf-8"), salt, 100000)
        return key.hex() == key_hex
    except Exception:
        return False


def get_or_create_contributor(
    db: Session,
    contributor_id_str: Optional[str] = None,
) -> Contributor:
    """
    Retrieves existing contributor by public contributor_id, or generates
    and persists a new Level 1 contributor identity with a unique non-identifying handle.
    """
    if contributor_id_str:
        existing = (
            db.query(Contributor)
            .filter(Contributor.contributor_id == contributor_id_str.strip())
            .first()
        )
        if existing:
            return existing

    # Generate unique non-identifying handle and internal public ID
    for _ in range(50):
        rand_num = random.randint(1000, 9999)
        c_id = f"SS-C-{rand_num}"
        d_name = f"{random.choice(WATERSHED_AVATARS)}-{rand_num}"

        conflict = (
            db.query(Contributor)
            .filter(
                (Contributor.contributor_id == c_id) | (Contributor.display_name == d_name)
            )
            .first()
        )
        if not conflict:
            contributor = Contributor(
                contributor_id=c_id,
                display_name=d_name,
                account_level="LEVEL_1_CONTRIBUTOR",
            )
            db.add(contributor)
            db.commit()
            db.refresh(contributor)
            return contributor

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not allocate a unique contributor identifier.",
    )


def upgrade_contributor_account(
    db: Session,
    contributor_id_str: str,
    email: str,
    password: str,
) -> Contributor:
    """
    Upgrades an existing Level 1 contributor in-place to Level 2 Registered Contributor.
    Preserves exact contributor_id, UUID, and all linked mission contribution history.
    """
    contributor = (
        db.query(Contributor)
        .filter(Contributor.contributor_id == contributor_id_str.strip())
        .first()
    )
    if not contributor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contributor '{contributor_id_str}' not found.",
        )

    # Check if email is already in use by another contributor
    existing_email = (
        db.query(Contributor)
        .filter(Contributor.email == email.strip().lower(), Contributor.id != contributor.id)
        .first()
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered to another contributor.",
        )

    contributor.email = email.strip().lower()
    contributor.hashed_password = hash_password(password)
    contributor.account_level = "LEVEL_2_REGISTERED"

    db.commit()
    db.refresh(contributor)
    return contributor
