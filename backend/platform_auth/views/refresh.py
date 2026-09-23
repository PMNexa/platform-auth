"""POST /api/v1/auth/refresh - the piece that makes "stay logged in
across a reload" possible: the access token lives only in memory on the
frontend (see platform-auth-frontend's tokenStore), so a page reload has
none - this exchanges the httpOnly refresh cookie (which DOES survive a
reload) for a new one.
"""

from datetime import UTC, datetime

from django.conf import settings
from rest_framework.views import APIView

from core_api.errors import Unauthorized
from platform_auth.models import RefreshToken
from platform_auth.security import hash_refresh_token
from platform_auth.views._session import issue_session_response


class RefreshView(APIView):
    authentication_classes = []

    def post(self, request):
        raw_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw_token:
            raise Unauthorized()

        token = RefreshToken.objects.filter(token_hash=hash_refresh_token(raw_token)).first()
        if token is None or token.revoked_at is not None or token.expires_at <= datetime.now(UTC):
            raise Unauthorized()

        # Atomic conditional update (compare-and-swap): only proceeds if
        # this exact row was still unrevoked the instant this ran. Two
        # concurrent requests presenting the SAME raw token (e.g. a
        # network retry, or actual token theft/replay) - exactly one
        # wins this race; the other gets rows_updated == 0 and 401s,
        # rather than both minting a valid new token from one old one.
        rows_updated = RefreshToken.objects.filter(id=token.id, revoked_at__isnull=True).update(
            revoked_at=datetime.now(UTC), revoked_reason="rotated"
        )
        if rows_updated == 0:
            raise Unauthorized()

        return issue_session_response(token.user)
