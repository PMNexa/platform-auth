"""Password hashing, JWT issuance/verification, refresh-token hashing.
Ported near-verbatim from platform-core's accounts/security.py.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from django.conf import settings
from passlib.context import CryptContext

_pwd_context = CryptContext(
    schemes=["argon2"],
    argon2__time_cost=3,
    argon2__memory_cost=65536,
    argon2__parallelism=4,
)

# Computed once at import time so a login against a nonexistent email still
# pays the same argon2-verify cost as a real one - closes the timing
# side-channel that would otherwise let an attacker enumerate valid emails.
_DUMMY_PASSWORD_HASH = _pwd_context.hash("dummy-password-for-timing-safety")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password_or_dummy(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _pwd_context.verify(password, _DUMMY_PASSWORD_HASH)
        return False
    return _pwd_context.verify(password, password_hash)


def create_access_token(actor_id: str, expires_minutes: float | None = None) -> str:
    ttl_minutes = expires_minutes if expires_minutes is not None else settings.JWT_ACCESS_TTL_MINUTES
    now = datetime.now(UTC)
    claims: dict[str, Any] = {
        "sub": str(actor_id),
        "iat": now,
        "exp": now + timedelta(minutes=ttl_minutes),
        "type": "access",
    }
    return jwt.encode(claims, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
