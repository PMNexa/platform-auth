"""Account rules that more than one view applies: who may sign up, when
an email must be verified, sending the account emails, and protecting
the last admin. Settings are system settings (`core_api.system`),
registered in apps.py, editable on the admin's System page:

- `auth.signup_policy`: open | invite_only (only an email the host says
  was invited - `PLATFORM_AUTH_IS_INVITED`, a dotted path to
  `fn(email) -> bool`) | closed.
- `auth.allowed_email_domains`: signup only from these (empty = any).
- `auth.require_email_verification`: new accounts confirm their email
  before they can log in. Only enforced while email is configured - an
  instance that can't send mail must not lock everyone out.

Links in emails point at the host's pages (`PLATFORM_AUTH_PAGES`,
default `/auth/verify` and `/auth/reset`) on the address the request came
in on.
"""

from urllib.parse import urlencode

from django.conf import settings
from django.utils.module_loading import import_string

from core_api.system import email_configured, get_setting, send_email
from platform_auth.models import RoleAssignment, User
from platform_auth.tokens import RESET, VERIFY, make_token

OPEN, INVITE_ONLY, CLOSED = "open", "invite_only", "closed"
DEFAULT_PAGES = {"verify": "/auth/verify", "reset": "/auth/reset", "login": "/auth/login"}


def verification_required() -> bool:
    return bool(get_setting("auth.require_email_verification")) and email_configured()


def signup_refusal(email: str) -> tuple[str, str] | None:
    """(code, message) when `email` may not sign up under the current policy."""
    policy = get_setting("auth.signup_policy")
    if policy == CLOSED:
        return "signup_closed", "Sign-ups are closed. Ask an administrator for an account."
    domains = [d.lower().lstrip("@") for d in get_setting("auth.allowed_email_domains") or []]
    domain = email.rsplit("@", 1)[-1].lower()
    if domains and domain not in domains:
        return "signup_domain", f"Sign-ups are limited to {', '.join('@' + d for d in domains)} addresses."
    if policy == INVITE_ONLY:
        check = getattr(settings, "PLATFORM_AUTH_IS_INVITED", None)
        if not (check and import_string(check)(email)):
            return "signup_invite_only", "Sign-ups are by invitation only. Use the link from your invitation."
    return None


def page_url(request, page: str, **params) -> str:
    pages = {**DEFAULT_PAGES, **getattr(settings, "PLATFORM_AUTH_PAGES", {})}
    base = request.build_absolute_uri("/").rstrip("/")
    return f"{base}{pages[page]}" + (f"?{urlencode(params)}" if params else "")


def _greeting(user: User) -> str:
    return f"Hi {user.name.split(' ')[0]}," if user.name.strip() else "Hi,"


def send_verification(request, user: User) -> None:
    url = page_url(request, "verify", token=make_token(user, VERIFY))
    send_email(
        user.email,
        "Confirm your email",
        f"{_greeting(user)}\n\nConfirm your email address to finish signing up:\n\n{url}\n\n"
        "The link works for 7 days. If you didn't sign up, ignore this email.",
        html=_html(user, "Confirm your email address to finish signing up.", url, "Confirm email",
                   "The link works for 7 days. If you didn't sign up, ignore this email."),
        kind="verify_email",
        user_id=user.id,
    )


def reset_url(request, user: User, *, long: bool = False) -> str:
    return page_url(request, "reset", token=make_token(user, RESET, long=long))


def send_password_reset(request, user: User) -> None:
    url = reset_url(request, user)
    send_email(
        user.email,
        "Reset your password",
        f"{_greeting(user)}\n\nSomeone asked to reset your password. Choose a new one here:\n\n{url}\n\n"
        "The link works once, for 2 hours. If it wasn't you, ignore this email - your password stays as it is.",
        html=_html(user, "Someone asked to reset your password.", url, "Choose a new password",
                   "The link works once, for 2 hours. If it wasn't you, ignore this email."),
        kind="password_reset",
        user_id=user.id,
    )


def send_invitation(request, user: User, inviter: User | None) -> str:
    url = reset_url(request, user, long=True)
    who = inviter.name if inviter and inviter.name else "An administrator"
    send_email(
        user.email,
        "You've been invited to GoalNexa",
        f"{_greeting(user)}\n\n{who} created a GoalNexa account for you. Set your password to get started:\n\n{url}\n\n"
        "The link works for 3 days.",
        html=_html(user, f"{who} created a GoalNexa account for you.", url, "Set your password",
                   "The link works for 3 days."),
        kind="invitation",
        user_id=user.id,
    )
    return url


def send_notice(user: User, subject: str, text: str, kind: str) -> None:
    send_email(user.email, subject, f"{_greeting(user)}\n\n{text}", kind=kind, user_id=user.id)


def _html(user: User, lead: str, url: str, button: str, small: str) -> str:
    from django.utils.html import escape

    return (
        '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1d273b;max-width:520px">'
        f"<p>{escape(_greeting(user))}</p><p>{escape(lead)}</p>"
        f'<p><a href="{escape(url)}" style="display:inline-block;background:#206bc4;color:#fff;padding:10px 18px;'
        f'border-radius:4px;text-decoration:none">{escape(button)}</a></p>'
        f'<p style="color:#667382;font-size:13px">{escape(small)}<br>{escape(url)}</p></div>'
    )


def admins():
    """Active users holding an app-wide role that grants everything."""
    ids = RoleAssignment.objects.filter(scope_id__isnull=True, role__grants_all=True).values("user_id")
    return User.objects.filter(id__in=ids, is_active=True)


def is_last_admin(user: User) -> bool:
    return admins().filter(id=user.id).exists() and admins().count() == 1
