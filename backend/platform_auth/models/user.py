from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7


#: Never a valid hash - an account that has no password (yet).
UNUSABLE_PASSWORD = "!"


class User(TimestampedModel):
    """No Actor/AIAgent polymorphism here (unlike platform-core) - this
    service does only human login for now; an agent-auth concept can be
    added later if/when an agent-facing module needs one, without
    redesigning this table.

    `is_active` False = disabled by an admin: no login, no token refresh,
    and an access token stops working on its next request
    (`ActorAuthentication`). `email_verified_at` is set by the email
    link (or a password reset/invite link, which prove the address too);
    an unverified account can't log in while the instance requires
    verification (`accounts.verification_required`). A password hash of
    `UNUSABLE_PASSWORD` (an invited account that hasn't set one) never
    matches. `failed_login_count` counts wrong passwords in a row;
    reaching `auth.lockout_attempts` sets `locked_until` (`lockout.py`).
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True, db_default=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    failed_login_count = models.PositiveIntegerField(default=0, db_default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user"

    @property
    def is_authenticated(self) -> bool:
        """Fixed `True`, matching Django's own convention (only
        `AnonymousUser` is `False`) - a real `User` instance only ever
        exists here because `ActorAuthentication` already resolved one
        from a verified JWT. Needed because DRF's own `IsAuthenticated`
        permission class checks this attribute directly on whatever
        `request.user` is; a module importing this app (e.g. platform_org)
        may declare that permission class explicitly rather than doing
        its own `request.user is None` check the way this app's own
        views do.
        """
        return True
