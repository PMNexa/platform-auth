"""Single sign-on (`platform_auth/sso.py`), as two browser redirects:

- `GET auth/sso/start?next=/path` - to the provider, with what the
  callback must get back (state, nonce, PKCE verifier, `next`) in a
  signed, httpOnly, 10-minute cookie.
- `GET auth/sso/callback?code&state` - back from the provider: signs the
  person in (the refresh cookie, as a login sets it) and redirects to the
  host's `sso` page (`PLATFORM_AUTH_PAGES`, default `/auth/sso`), which
  trades the cookie for an access token. A sign-in that fails goes to
  the `login` page with `?sso_error=<code>` - a code, never the
  provider's own text.

And `GET auth/config` - what the public auth pages need to know before
anyone is signed in.
"""

import hmac
import logging

from django.conf import settings
from django.core import signing
from django.http import Http404, HttpResponseRedirect
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_auth import passwords, sso
from platform_auth.accounts import page_url
from platform_auth.views._session import set_refresh_cookie, start_session

logger = logging.getLogger(__name__)

STATE_COOKIE = "sso_state"
STATE_SALT = "platform_auth.sso.state"
STATE_MAX_AGE = 600


def _cookie_path() -> str:
    return f"{settings.URL_PREFIX}/api/v1/auth/sso"


def _safe_next(value) -> str:
    """Same-origin paths only - `?next=` must not become an open redirect."""
    value = value if isinstance(value, str) else ""
    return value if value.startswith("/") and not value.startswith(("//", "/\\")) else "/"


def _failed(request, code: str, next_path: str = "/") -> HttpResponseRedirect:
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
            "sso": {"label": sso.label(), "start_url": f"{settings.URL_PREFIX}/api/v1/auth/sso/start"}
            if sso.configured() else None,
        })


class SsoStartView(APIView):
    authentication_classes = []

    def get(self, request):
        if not sso.configured():
            raise Http404()
        next_path = _safe_next(request.query_params.get("next"))
        try:
            url, pending = sso.begin(request)
        except sso.SsoError as exc:
            logger.warning("SSO start failed: %s", exc)
            return _failed(request, exc.code, next_path)
        response = HttpResponseRedirect(url)
        response.set_cookie(
            STATE_COOKIE,
            signing.dumps({**pending, "next": next_path}, salt=STATE_SALT, compress=True),
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
        if not hmac.compare_digest(str(request.query_params.get("state", "")), str(pending.get("s", ""))):
            return _failed(request, "expired", next_path)
        if request.query_params.get("error"):
            # The person cancelled, or the provider refused them.
            return _failed(request, "denied", next_path)
        try:
            claims = sso.complete(request, request.query_params.get("code", ""), pending)
            user = sso.resolve_user(claims, request)
        except sso.SsoError as exc:
            logger.warning("SSO sign-in failed (%s): %s", exc.code, exc)
            return _failed(request, exc.code, next_path)

        _access_token, refresh_token, max_age = start_session(user, request)
        response = HttpResponseRedirect(page_url(request, "sso", **({"next": next_path} if next_path != "/" else {})))
        set_refresh_cookie(response, refresh_token, max_age)
        response.delete_cookie(STATE_COOKIE, path=_cookie_path(), samesite="Lax")
        return response
