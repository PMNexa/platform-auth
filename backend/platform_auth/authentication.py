"""Bearer-JWT DRF authentication - plain BaseAuthentication, never
SessionAuthentication, so DRF never enforces CSRF (matches the
cookie-based-refresh, header-based-access-token flow with no CSRF token).
"""

import jwt
from rest_framework.authentication import BaseAuthentication

from core_api.errors import ApiError, Unauthorized
from platform_auth.models import User
from platform_auth.security import decode_token


class ActorAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None

        token = header[len("Bearer "):].strip()
        if not token:
            return None

        try:
            claims = decode_token(token)
        except jwt.PyJWTError:
            raise Unauthorized() from None

        try:
            user = User.objects.get(pk=claims.get("sub"))
        except (User.DoesNotExist, ValueError, TypeError):
            raise Unauthorized() from None
        # Disabling an account takes effect now, not when this token expires.
        if not user.is_active:
            raise Unauthorized("This account is disabled.")
        # An admin's "view as" token (`UserViewSet.impersonate`): reads only.
        if claims.get("imp"):
            if request.method not in ("GET", "HEAD", "OPTIONS"):
                raise ApiError(403, "read_only_view", "You're viewing as this user - read-only.")
            user.impersonated_by = claims["imp"]

        return (user, None)

    def authenticate_header(self, request):
        return "Bearer"
