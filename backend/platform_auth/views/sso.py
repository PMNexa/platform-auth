"""Single sign-on (`platform_auth/sso.py`), as two browser redirects:

- `GET auth/sso/start?provider=<id>&next=/path` - to that provider (no
  `provider`: the first one), with what the callback must get back
  (state, nonce, PKCE verifier, the provider's id, `next`) in a signed,
  httpOnly, 10-minute cookie.
- `GET auth/sso/callback?code&state` - back from the provider: signs the
  person in (the refresh cookie, as a login sets it) and redirects to the
  host's `sso` page (`PLATFORM_AUTH_PAGES`, default `/auth/sso`), which
  trades the cookie for an access token. A sign-in that fails goes to
  the `login` page with `?sso_error=<code>` - a code, never the
  provider's own text.

A phone app signs in through the same two redirects, in a browser tab it
opens (Android Custom Tab, iOS ASWebAuthenticationSession):
`auth/sso/start?provider=<id>&app_redirect=<uri>&code_challenge=<S256>`.
`app_redirect` must be one of `PLATFORM_AUTH_APP_REDIRECTS` (e.g.
`goalnexa://auth/sso`); the callback then sends the browser to it with a
one-time `?code=` (or `?error=<code>`) instead of setting a cookie, and the
app trades the code plus its PKCE `code_verifier` for a native session at
`POST auth/sso/token` (`AppAuthCode`: two minutes, once).

And `GET auth/config` - what the public auth pages (and the phone apps)
need to know before anyone is signed in.
"""

import base64
import hashlib
import hmac
import logging
import re
import secrets
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

from django.conf import settings
from django.core import signing
from django.http import Http404, HttpResponseRedirect
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core_api.errors import ApiError
from core_api.system import get_setting
from platform_auth import passwords, sso
from platform_auth.accounts import page_url
from platform_auth.models import AppAuthCode
from platform_auth.throttling import LoginRateThrottle
from platform_auth.views._session import issue_session_response, set_refresh_cookie, start_session

logger = logging.getLogger(__name__)

STATE_COOKIE = "sso_state"
STATE_SALT = "platform_auth.sso.state"
STATE_MAX_AGE = 600
APP_CODE_TTL = timedelta(minutes=2)
#: RFC 7636: a base64url SHA-256 is 43 characters.
CODE_CHALLENGE = re.compile(r"^[A-Za-z0-9_-]{43}$")
CODE_VERIFIER = re.compile(r"^[A-Za-z0-9._~-]{43,128}$")


class AppRedirect(HttpResponseRedirect):
    """A redirect to a phone app's own scheme (`goalnexa://...`), which
    Django's redirect refuses by default. Only ever to an address in
    `PLATFORM_AUTH_APP_REDIRECTS`."""

    def __init__(self, url, *args, **kwargs):
        self.allowed_schemes = [urlsplit(url).scheme]
        super().__init__(url, *args, **kwargs)


def _app_redirect(value) -> str:
    """`value` if it's an allowed app redirect, else ""."""
    allowed = getattr(settings, "PLATFORM_AUTH_APP_REDIRECTS", [])
    return value if isinstance(value, str) and value in allowed else ""


def _to_app(redirect: str, **params) -> AppRedirect:
    response = AppRedirect(f"{redirect}{'&' if '?' in redirect else '?'}{urlencode(params)}")
    response.delete_cookie(STATE_COOKIE, path=_cookie_path(), samesite="Lax")
    return response


def _s256(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()


def _cookie_path() -> str:
    return f"{settings.URL_PREFIX}/api/v1/auth/sso"


def _safe_next(value) -> str:
    """Same-origin paths only - `?next=` must not become an open redirect."""
    value = value if isinstance(value, str) else ""
    return value if value.startswith("/") and not value.startswith(("//", "/\\")) else "/"


def _failed(request, code: str, next_path: str = "/", app: str = "") -> HttpResponseRedirect:
    if app:
        return _to_app(app, error=code)
    params = {"sso_error": code, **({"next": next_path} if next_path != "/" else {})}
    response = HttpResponseRedirect(page_url(request, "login", **params))
    response.delete_cookie(STATE_COOKIE, path=_cookie_path(), samesite="Lax")
    return response


class AuthConfigView(APIView):
    authentication_classes = []

    def get(self, request):
        return Response({
            "password_login": sso.password_login_enabled(),
            "password_min_length": passwords.min_length(),
            # One button each, in this order.
            "sso": [
                {"id": p.id, "label": p.label, "icon": sso.icon(p),
                 "start_url": f"{settings.URL_PREFIX}/api/v1/auth/sso/start?provider={p.id}"}
                for p in sso.providers()
            ],
            # The oldest phone app version this server still works with
            # ("" = any): an older one asks its user to update.
            "min_app_version": {
                "android": get_setting("apps.min_android_version"),
                "ios": get_setting("apps.min_ios_version"),
            },
        })


class SsoStartView(APIView):
    authentication_classes = []

    def get(self, request):
        provider = sso.provider(request.query_params.get("provider"))
        if provider is None:
            raise Http404()
        next_path = _safe_next(request.query_params.get("next"))
        app_extra = {}
        if "app_redirect" in request.query_params:
            app = _app_redirect(request.query_params.get("app_redirect"))
            if not app:
                raise ApiError(400, "invalid_app_redirect", "This app address isn't allowed here.")
            challenge = request.query_params.get("code_challenge", "")
            if not CODE_CHALLENGE.match(challenge) or request.query_params.get("code_challenge_method", "S256") != "S256":
                return _failed(request, "invalid_request", app=app)
            device = request.query_params.get("device_name", "")
            app_extra = {"a": app, "c": challenge, "d": device[:100] if isinstance(device, str) else ""}
        try:
            url, pending = sso.begin(request, provider)
        except sso.SsoError as exc:
            logger.warning("SSO start failed: %s", exc)
            return _failed(request, exc.code, next_path, app_extra.get("a", ""))
        response = HttpResponseRedirect(url)
        response.set_cookie(
            STATE_COOKIE,
            signing.dumps({**pending, **app_extra, "next": next_path}, salt=STATE_SALT, compress=True),
            max_age=STATE_MAX_AGE,
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            # Lax: the provider's redirect back is a top-level navigation, which still carries it.
            samesite="Lax",
            path=_cookie_path(),
        )
        return response


class SsoCallbackView(APIView):
    authentication_classes = []

    def get(self, request):
        if not sso.configured():
            raise Http404()
        try:
            pending = signing.loads(request.COOKIES.get(STATE_COOKIE, ""), salt=STATE_SALT, max_age=STATE_MAX_AGE)
        except signing.BadSignature:
            return _failed(request, "expired")
        next_path = _safe_next(pending.get("next"))
        app = _app_redirect(pending.get("a"))
        if not hmac.compare_digest(str(request.query_params.get("state", "")), str(pending.get("s", ""))):
            return _failed(request, "expired", next_path, app)
        # The one the sign-in was started with - it may have been removed since.
        provider = sso.provider(str(pending.get("p") or sso.DEFAULT_ID))
        if provider is None:
            return _failed(request, "expired", next_path, app)
        # Every provider comes back to this one address; one that says who
        # it is (RFC 9207) must be the one we sent the browser to.
        answered_by = request.query_params.get("iss")
        if answered_by and answered_by.rstrip("/") != provider.issuer:
            return _failed(request, "expired", next_path, app)
        if request.query_params.get("error"):
            # The person cancelled, or the provider refused them.
            return _failed(request, "denied", next_path, app)
        try:
            claims = sso.complete(request, provider, request.query_params.get("code", ""), pending)
            user = sso.resolve_user(claims, request, provider)
        except sso.SsoError as exc:
            logger.warning("SSO sign-in failed (%s): %s", exc.code, exc)
            return _failed(request, exc.code, next_path, app)

        if app:
            # A phone app: hand it a one-time code; it trades the code for
            # a session itself (SsoTokenView), never through this browser.
            code = secrets.token_urlsafe(32)
            AppAuthCode.objects.create(
                user=user,
                code_hash=hashlib.sha256(code.encode()).hexdigest(),
                code_challenge=str(pending.get("c", "")),
                device_name=str(pending.get("d", ""))[:100],
                expires_at=timezone.now() + APP_CODE_TTL,
            )
            return _to_app(app, code=code)

        _access_token, refresh_token, max_age = start_session(user, request)
        response = HttpResponseRedirect(page_url(request, "sso", **({"next": next_path} if next_path != "/" else {})))
        set_refresh_cookie(response, refresh_token, max_age)
        response.delete_cookie(STATE_COOKIE, path=_cookie_path(), samesite="Lax")
        return response


class SsoTokenView(APIView):
    """`POST auth/sso/token` with `{code, code_verifier}` - a phone app's
    side of an SSO sign-in: the one-time code from its redirect, plus the
    PKCE verifier behind the `code_challenge` it started with. Answers
    with a native session (refresh token in the body). A code works once,
    for two minutes."""

    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        code = request.data.get("code")
        verifier = request.data.get("code_verifier")
        if not isinstance(code, str) or not code or not isinstance(verifier, str) or not CODE_VERIFIER.match(verifier):
            raise ApiError(400, "invalid_grant", "This sign-in link has expired. Sign in again.")
        row = AppAuthCode.objects.filter(code_hash=hashlib.sha256(code.encode()).hexdigest()).select_related("user").first()
        now = timezone.now()
        if (
            row is None
            or row.expires_at <= now
            or not hmac.compare_digest(_s256(verifier), row.code_challenge)
            # Once only: of two requests with the same code, one wins.
            or AppAuthCode.objects.filter(id=row.id, used_at__isnull=True).update(used_at=now) == 0
        ):
            raise ApiError(400, "invalid_grant", "This sign-in link has expired. Sign in again.")
        if not row.user.is_active:
            raise ApiError(403, "account_disabled", "This account is disabled. Contact an administrator.")
        return issue_session_response(row.user, request, native=True, device_name=row.device_name)
