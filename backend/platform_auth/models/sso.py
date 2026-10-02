from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7
from platform_auth.models.user import User


class SsoIdentity(TimestampedModel):
    """An account at the single sign-on provider that signs in as `user`:
    the provider's issuer plus its `sub` for the person - never the email,
    which can change there. Made the first time someone signs in with SSO
    (`sso.resolve_user`)."""

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sso_identities")
    issuer = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    # As the provider reported it at the last sign-in - for the admin, not for matching.
    email = models.EmailField(blank=True, default="")
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "sso_identity"
        constraints = [models.UniqueConstraint(fields=["issuer", "subject"], name="sso_identity_issuer_subject")]
