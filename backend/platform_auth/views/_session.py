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


def _client_ip(request) -> str:
    from rest_framework.throttling import BaseThrottle

    try:
        return BaseThrottle().get_ident(request) or ""
    except Exception:
        return ""


def start_session(user: User, request=None) -> tuple[str, str, int]:
    """(access token, raw refresh token, the refresh cookie's max-age).
    Every refresh token - from login/signup or a rotation (see
    views/refresh.py) - gets a fresh `JWT_REFRESH_TTL_DAYS` window: a
    sliding expiry, so a session lasts until logout as long as it's used
    at least once per window. Only an idle session expires. `request`
    (when given) records where the session came from.
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
        ip=_client_ip(request) if request is not None else "",
        user_agent=(request.META.get("HTTP_USER_AGENT", "")[:255] if request is not None else ""),
    )
    return access_token, raw_refresh_token, int((expires_at - now).total_seconds())


def set_refresh_cookie(response, raw_refresh_token: str, max_age: int) -> None:
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        raw_refresh_token,
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite="Lax",
        max_age=max_age,
        path=f"{settings.URL_PREFIX}/api/v1/auth",
    )


def issue_session_response(user: User, request=None) -> Response:
    """Login and signup's answer: the access token in the body, the refresh token in its cookie."""
    access_token, raw_refresh_token, max_age = start_session(user, request)
    response = Response(
        {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserSerializer(user).data,
        }
    )
    set_refresh_cookie(response, raw_refresh_token, max_age)
    return response


def revoke_all_sessions(user: User, reason: str) -> int:
    """Revokes every refresh token the user holds - their logins end at the
    next refresh (an access token lives 15 minutes at most; a disabled
    user's is refused right away by `ActorAuthentication`)."""
    return RefreshToken.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=datetime.now(UTC), revoked_reason=reason
    )
