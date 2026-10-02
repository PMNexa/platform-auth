"""Locks an account after too many wrong passwords in a row -
`auth.lockout_attempts` (0 = never) for `auth.lockout_minutes`, both
system settings (apps.py). While locked, even the right password is
refused. A successful login or a password reset clears it, as does an
admin's Unlock on the user's page; the lock also just runs out.

Only real accounts lock, so the "locked" answer tells a guesser the
email has an account - signup's `email_taken` already does. And anyone
who knows an email can lock its account for a while: keep the window
short, and let the reset link (which unlocks) be the way back in.
"""

import math
from datetime import timedelta

from django.db.models import F
from django.utils import timezone

from core_api.errors import ApiError
from core_api.system import audit, get_setting
from platform_auth.models import User


def locked_error(until) -> ApiError:
    minutes = max(math.ceil((until - timezone.now()).total_seconds() / 60), 1)
    return ApiError(
        403, "account_locked",
        f"Too many failed attempts - this account is locked for {minutes} more minute{'s' if minutes != 1 else ''}. "
        "Resetting your password unlocks it.",
    )


def check_not_locked(user: User, request) -> None:
    if user.locked_until and user.locked_until > timezone.now():
        audit("auth.login_failed", request=request, actor=None, target=user, reason="locked")
        raise locked_error(user.locked_until)


def record_failure(user: User, request) -> None:
    """A wrong password for `user`. Raises the locked error when this one locks the account."""
    attempts = int(get_setting("auth.lockout_attempts") or 0)
    if attempts <= 0:
        return
    User.objects.filter(id=user.id).update(failed_login_count=F("failed_login_count") + 1)
    count = User.objects.values_list("failed_login_count", flat=True).get(id=user.id)
    if count < attempts:
        return
    minutes = max(int(get_setting("auth.lockout_minutes") or 0), 1)
    until = timezone.now() + timedelta(minutes=minutes)
    User.objects.filter(id=user.id).update(locked_until=until, failed_login_count=0)
    audit("auth.account_locked", request=request, actor=None, target=user, attempts=count, minutes=minutes)
    # Imported here: accounts.py imports the models this module shares.
    from platform_auth.accounts import send_notice

    send_notice(
        user, "Your account was locked",
        f"Someone entered a wrong password for your GoalNexa account {count} times in a row, so it is locked for "
        f"{minutes} minutes.\n\nIf that was you, wait or reset your password - that unlocks it. If it wasn't, your "
        "password was not guessed; you don't need to do anything.",
        "account_locked",
    )
    raise locked_error(until)


def clear(user: User) -> None:
    if user.failed_login_count or user.locked_until:
        User.objects.filter(id=user.id).update(failed_login_count=0, locked_until=None)
