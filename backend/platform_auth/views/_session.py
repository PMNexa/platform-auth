"""Shared session-issuing logic - login, signup, setup, a password change,
a refresh and an app's SSO exchange all end a request the same way (JWT
access token in the body, httpOnly refresh cookie), so this is factored
out rather than duplicated between the views.

A phone app has no cookie jar to rely on: it sends `"client": "native"`
(and optionally `"device_name"`) in the request body, and gets the
refresh token in the body instead (`refresh_token`, `refresh_expires_in`)
- no cookie. It keeps the token in the platform's secure storage and
sends it back in the body of `refresh` and `logout`. The session
remembers it's native, so every rotation answers the same way.
"""

from datetime import UTC, datetime, timedelta

from django.conf import settings
from rest_framework.response import Response

from core_api.system import WEB, seen

from platform_auth.models import RefreshToken, User
from platform_auth.security import create_access_token, create_refresh_token, hash_refresh_token
from platform_auth.serializers import UserSerializer


def _client_ip(request) -> str:
    from rest_framework.throttling import BaseThrottle

    try:
        return BaseThrottle().get_ident(request) or ""
    except Exception:
        return ""


WEB_CLIENT, NATIVE_CLIENT = "web", "native"


def native_client(request) -> tuple[bool, str]:
    """(Whether the caller asked for a native session, its device name)."""
    data = getattr(request, "data", None)
    if not hasattr(data, "get") or data.get("client") != NATIVE_CLIENT:
        return False, ""
    name = data.get("device_name")
    return True, (name.strip()[:100] if isinstance(name, str) else "")


def raw_refresh_token(request) -> str:
    """The refresh token a request presents: a native app's in the body,
    the website's in its cookie."""
    data = getattr(request, "data", None)
    body = data.get("refresh_token") if hasattr(data, "get") else None
    if isinstance(body, str) and body:
        return body
    return request.COOKIES.get(settings.REFRESH_COOKIE_NAME) or ""


def start_session(
    user: User, request=None, *, client: str = WEB_CLIENT, device_name: str = ""
) -> tuple[str, str, int]:
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
        client=client,
        device_name=device_name,
    )
    # Every sign-in and every 15-minute refresh of an open page: the user is
    # active on the website (System > Insights).
    seen(user.id, WEB)
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


def issue_session_response(user: User, request=None, *, native: bool | None = None, device_name: str = "") -> Response:
    """The access token in the body; the refresh token in its cookie - or,
    for a native app (`native`, else asked for in the request body), in
    the body too."""
    if native is None:
        native, device_name = native_client(request) if request is not None else (False, "")
    access_token, raw_refresh_token, max_age = start_session(
        user, request, client=NATIVE_CLIENT if native else WEB_CLIENT, device_name=device_name
    )
    body = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserSerializer(user).data,
    }
    if native:
        body["refresh_token"] = raw_refresh_token
        body["refresh_expires_in"] = max_age
        return Response(body)
    response = Response(body)
    set_refresh_cookie(response, raw_refresh_token, max_age)
    return response


def revoke_all_sessions(user: User, reason: str) -> int:
    """Revokes every refresh token the user holds - their logins end at the
    next refresh (an access token lives 15 minutes at most; a disabled
    user's is refused right away by `ActorAuthentication`)."""
    return RefreshToken.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=datetime.now(UTC), revoked_reason=reason
    )
