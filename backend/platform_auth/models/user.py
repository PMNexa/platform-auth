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
