"""Bearer-JWT DRF authentication - plain BaseAuthentication, never
SessionAuthentication, so DRF never enforces CSRF (matches the
cookie-based-refresh, header-based-access-token flow with no CSRF token).
"""

import jwt
from rest_framework.authentication import BaseAuthentication

from accounts.models import User
from accounts.security import decode_token
from core_api.errors import Unauthorized


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

        return (user, None)

    def authenticate_header(self, request):
        return "Bearer"
