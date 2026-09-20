"""User + RefreshToken. No Actor/AIAgent polymorphism here (unlike
platform-core) - this service does only human login for now; an agent-auth
concept can be added later if/when an agent-facing module needs one,
without redesigning this table.
"""

from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7


class User(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)

    class Meta:
        db_table = "user"


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
