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


def issue_session_response(user: User) -> Response:
    """Every refresh token - from login/signup or a rotation (see
    views/refresh.py) - gets a fresh `JWT_REFRESH_TTL_DAYS` window: a
    sliding expiry, so a session lasts until logout as long as it's used
    at least once per window. Only an idle session expires.
    """
    access_token = create_access_token(str(user.id))

    raw_refresh_token = create_refresh_token()
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
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
    max_age = int((expires_at - now).total_seconds())
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
