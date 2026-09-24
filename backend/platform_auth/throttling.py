"""Rate limits on the public auth endpoints (login, signup, setup).

Rates come from the host's `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`,
read on every request (not DRF's import-time snapshot, so
`override_settings` works in tests). A scope with no rate there is not
limited at all - a host opts in by listing it:

    "DEFAULT_THROTTLE_RATES": {
        "auth_login": "10/min",        # login attempts per client IP
        "auth_login_email": "20/hour", # login attempts per account email
        "auth_signup": "10/hour",      # signup + first-run setup per IP
    }

Counts live in Django's `default` cache - a per-process cache
(LocMemCache, Django's default) gives each worker its own count, so a
host running several workers or replicas wants a shared one (database,
Redis). The client IP is DRF's: `REMOTE_ADDR`, or the entry
`NUM_PROXIES` from the end of `X-Forwarded-For` behind a proxy.
"""

from rest_framework.settings import api_settings
from rest_framework.throttling import SimpleRateThrottle


class _AuthThrottle(SimpleRateThrottle):
    def get_rate(self):
        return (api_settings.DEFAULT_THROTTLE_RATES or {}).get(self.scope)

    def get_cache_key(self, request, view):
        if request.method != "POST":
            return None
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class LoginRateThrottle(_AuthThrottle):
    scope = "auth_login"


class LoginEmailRateThrottle(_AuthThrottle):
    """Per account, whichever IPs the attempts come from - slows password
    guessing spread over many addresses. Also lets anyone slow a known
    email's logins, so keep this rate well above a real user's retries."""

    scope = "auth_login_email"

    def get_cache_key(self, request, view):
        email = request.data.get("email") if request.method == "POST" and hasattr(request.data, "get") else None
        if not isinstance(email, str) or not email.strip():
            return None
        return self.cache_format % {"scope": self.scope, "ident": email.strip().lower()}


class SignupRateThrottle(_AuthThrottle):
    scope = "auth_signup"
