"""Signed one-time links - email verification and password reset - with
no table: the token is the user's id plus a fingerprint, signed with
SECRET_KEY and timestamped (`django.core.signing`).

- VERIFY carries the email it was sent to: it stops working if the
  account's email changes.
- RESET carries a fingerprint of the current password hash: it works
  once - setting a password changes the hash - and dies if the password
  changes some other way.
"""

import hashlib
from datetime import timedelta

from django.core import signing

from platform_auth.models import User

VERIFY = "verify"
RESET = "reset"
SALT = "platform_auth.link."
VERIFY_MAX_AGE = timedelta(days=7)
RESET_MAX_AGE = timedelta(hours=2)
#: An admin's reset link or an invitation - sent by hand, so it lasts longer.
LONG_RESET_MAX_AGE = timedelta(days=3)


def _fingerprint(user: User, purpose: str) -> str:
    source = user.email if purpose == VERIFY else user.password_hash
    return hashlib.sha256(f"{purpose}:{source}".encode()).hexdigest()[:16]


def make_token(user: User, purpose: str, *, long: bool = False) -> str:
    return signing.dumps(
        {"u": str(user.id), "f": _fingerprint(user, purpose), "l": long}, salt=SALT + purpose, compress=True
    )


def read_token(token: str, purpose: str) -> User | None:
    """The user a still-valid token is for, else None."""
    try:
        data = signing.loads(token, salt=SALT + purpose, max_age=None)
        max_age = VERIFY_MAX_AGE if purpose == VERIFY else LONG_RESET_MAX_AGE if data.get("l") else RESET_MAX_AGE
        signing.loads(token, salt=SALT + purpose, max_age=max_age)
    except (signing.BadSignature, signing.SignatureExpired, TypeError, ValueError):
        return None
    user = User.objects.filter(id=data.get("u")).first()
    if user is None or data.get("f") != _fingerprint(user, purpose):
        return None
    return user
