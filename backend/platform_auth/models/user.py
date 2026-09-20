from django.db import models

from core_api.utils import TimestampedModel, generate_uuid7


class User(TimestampedModel):
    """No Actor/AIAgent polymorphism here (unlike platform-core) - this
    service does only human login for now; an agent-auth concept can be
    added later if/when an agent-facing module needs one, without
    redesigning this table.
    """

    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)

    class Meta:
        db_table = "user"
