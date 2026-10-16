from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from platform_auth.models.user import User


class RefreshToken(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    user = models.ForeignKey(User, on_delete=models.RESTRICT, db_column="user_id")
    token_hash = models.CharField(max_length=255, unique=True, db_index=True)
    issued_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_reason = models.CharField(max_length=64, null=True, blank=True)
    # Where the session was started from - shown on the admin's session list.
    ip = models.CharField(max_length=64, blank=True, default="", db_default="")
    user_agent = models.CharField(max_length=255, blank=True, default="", db_default="")
    # "web" (the refresh token rides in an httpOnly cookie) or "native" (a
    # phone app keeps it itself and sends it in the body - views/_session.py).
    # A rotation keeps both, so a session stays what it started as.
    client = models.CharField(max_length=16, default="web", db_default="web")
    device_name = models.CharField(max_length=100, blank=True, default="", db_default="")

    class Meta:
        db_table = "refresh_token"


class AppAuthCode(TimestampedModel):
    """A one-time code that hands an SSO sign-in to a phone app
    (`views/sso.py`): the callback redirects to the app with the code, the
    app trades it - with the PKCE verifier only it knows - for a native
    session at `POST auth/sso/token`. Only the code's SHA-256 is kept;
    it lives two minutes and works once (`used_at`)."""

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id")
    code_hash = models.CharField(max_length=64, unique=True)
    code_challenge = models.CharField(max_length=128)
    device_name = models.CharField(max_length=100, blank=True, default="")
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "app_auth_code"
