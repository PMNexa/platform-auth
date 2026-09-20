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

    class Meta:
        db_table = "refresh_token"
