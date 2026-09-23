"""POST /api/v1/auth/logout - ends the session server-side: revokes the
refresh token behind the httpOnly cookie and clears the cookie, so a
later reload's boot refresh can't silently log back in. The access
token isn't needed (or checked) - it may well have expired already -
and a missing/unknown cookie is still a 204: the outcome the caller
wants (no session) already holds.
"""

from datetime import UTC, datetime

from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView

from platform_auth.models import RefreshToken
from platform_auth.security import hash_refresh_token


class LogoutView(APIView):
    authentication_classes = []

    def post(self, request):
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw_token:
            RefreshToken.objects.filter(token_hash=hash_refresh_token(raw_token), revoked_at__isnull=True).update(
                revoked_at=datetime.now(UTC), revoked_reason="logout"
            )

        response = Response(status=204)
        response.delete_cookie(
            settings.REFRESH_COOKIE_NAME,
            path=f"{settings.URL_PREFIX}/api/v1/auth",
            samesite="Lax",
        )
        return response
