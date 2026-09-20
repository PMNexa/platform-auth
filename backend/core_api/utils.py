"""UUIDv7 PK generator + timestamp mixin. Ported from platform-core."""

import time
import uuid
from datetime import UTC, datetime

from django.db import models

try:
    from uuid6 import uuid7 as _uuid7

    def generate_uuid7() -> uuid.UUID:
        return _uuid7()

except ImportError:  # pragma: no cover
    import os

    def generate_uuid7() -> uuid.UUID:
        unix_ts_ms = int(time.time() * 1000)
        rand_a = int.from_bytes(os.urandom(2), "big") & 0x0FFF
        rand_b = int.from_bytes(os.urandom(8), "big") & 0x3FFFFFFFFFFFFFFF
        uuid_int = (unix_ts_ms & 0xFFFFFFFFFFFF) << 80
        uuid_int |= 0x7 << 76
        uuid_int |= rand_a << 64
        uuid_int |= 0b10 << 62
        uuid_int |= rand_b
        return uuid.UUID(int=uuid_int)


def utcnow() -> datetime:
    return datetime.now(UTC)


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
