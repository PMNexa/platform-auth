"""Shared session-issuing logic - both login and signup end a request the
same way (JWT access token in the body, httpOnly refresh cookie), so this
is factored out rather than duplicated between the two views.
"""

from datetime import UTC, datetime, timedelta

from django.conf import settings
from rest_framework.response import Response

from platform_auth.models import RefreshToken, User
from platform_auth.security import create_access_token, create_refresh_token, hash_refresh_token
from platform_auth.serializers import UserSerializer


def issue_session_response(user: User, refresh_expires_at: datetime | None = None) -> Response:
    """`refresh_expires_at`: when rotating an existing refresh token (see
    views/refresh.py), the new token inherits the ORIGINAL token's
    absolute expiry rather than getting a fresh full TTL window - caps
    total session lifetime at the first login's TTL no matter how many
    times it's refreshed. `None` (login/signup - no prior token to
    inherit from) starts a fresh `JWT_REFRESH_TTL_DAYS` window.
    """
    access_token = create_access_token(str(user.id))

    raw_refresh_token = create_refresh_token()
    now = datetime.now(UTC)
    expires_at = refresh_expires_at if refresh_expires_at is not None else now + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
    RefreshToken.objects.create(
        user=user,
        token_hash=hash_refresh_token(raw_refresh_token),
        issued_at=now,
        expires_at=expires_at,
    )

    response = Response(
        {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserSerializer(user).data,
        }
    )
    # Cookie's own max_age matches the row's ACTUAL remaining lifetime,
    # not always a fresh full TTL window - matters on a rotation, where
    # expires_at was inherited from the original token, not extended.
    max_age = max(0, int((expires_at - now).total_seconds()))
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        raw_refresh_token,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite="Lax",
        max_age=max_age,
        path=f"{settings.URL_PREFIX}/api/v1/auth",
    )
    return response
