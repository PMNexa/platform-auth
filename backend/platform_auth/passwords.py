"""What a new password must satisfy - checked wherever one is set
(signup, first-run setup, reset/invitation link, change password), never
at login, so tightening the rules doesn't lock anyone out. Two system
settings (apps.py): `auth.password_min_length` and
`auth.password_reject_common` (Django's list of ~20,000 common
passwords)."""

from functools import cache

from rest_framework.exceptions import ValidationError

from core_api.system import get_setting

#: argon2 hashes any length; this only bounds the work one request can ask for.
MAX_LENGTH = 256


def min_length() -> int:
    return max(int(get_setting("auth.password_min_length") or 0), 1)


@cache
def _common_passwords():
    from django.contrib.auth.password_validation import CommonPasswordValidator

    return CommonPasswordValidator()


def password_problems(password: str, *, email: str = "") -> list[str]:
    problems = []
    if len(password) < min_length():
        problems.append(f"Use at least {min_length()} characters.")
    if len(password) > MAX_LENGTH:
        problems.append(f"Use at most {MAX_LENGTH} characters.")
    if email and password.strip().lower() == email.strip().lower():
        problems.append("Don't use your email address as your password.")
    elif get_setting("auth.password_reject_common") and password.lower().strip() in _common_passwords().passwords:
        problems.append("This password is too common - choose one that's harder to guess.")
    return problems


def check_password(password: str, *, email: str = "", field: str = "password") -> None:
    """Raises a 400 with the problems under `field`."""
    problems = password_problems(password, email=email)
    if problems:
        raise ValidationError({field: problems})
