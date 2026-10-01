from django.apps import AppConfig
from django.db.models.signals import post_migrate, post_save


class PlatformAuthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'platform_auth'

    def ready(self):
        from core_api.system import (
            BOOL,
            CHOICE,
            LIST,
            SettingDef,
            UsageProvider,
            register_export_provider,
            register_setting,
            register_usage_provider,
        )
        from platform_auth.rbac import signals

        register_setting(SettingDef(
            "auth.signup_policy", "Who can sign up", CHOICE, default="open", group="Accounts",
            choices=[("open", "Anyone"), ("invite_only", "Invited people only"), ("closed", "Nobody (admins invite users)")],
            env="AUTH_SIGNUP_POLICY",
            help="Invited: someone with a pending organization invitation. Admins can always invite from the Users page.",
        ))
        register_setting(SettingDef(
            "auth.allowed_email_domains", "Allowed email domains", LIST, default=[], group="Accounts",
            env="AUTH_ALLOWED_EMAIL_DOMAINS", help="Sign-ups only from these domains, one per line (e.g. acme.com). Empty: any.",
        ))
        register_setting(SettingDef(
            "auth.require_email_verification", "Require email verification", BOOL, default=False, group="Accounts",
            env="AUTH_REQUIRE_EMAIL_VERIFICATION",
            help="New accounts confirm their email before they can log in. Needs email to be configured.",
        ))

        post_migrate.connect(signals.sync_after_migrate, sender=self)
        post_save.connect(signals.assign_default_roles, sender=self.get_model("User"))
        register_usage_provider(UsageProvider("Accounts", _usage))
        register_export_provider("account", _export)


def _export(user_id: str) -> dict:
    from platform_auth.models import RefreshToken, RoleAssignment, User

    user = User.objects.get(id=user_id)
    return {
        "created_at": user.created_at,
        "email_verified_at": user.email_verified_at,
        "last_login_at": user.last_login_at,
        "roles": [
            {"role": a.role.name, "scope_id": str(a.scope_id) if a.scope_id else None}
            for a in RoleAssignment.objects.filter(user_id=user_id).select_related("role")
        ],
        "sessions": [
            {"started_at": t.issued_at, "expires_at": t.expires_at, "revoked_at": t.revoked_at, "ip": t.ip,
             "user_agent": t.user_agent}
            for t in RefreshToken.objects.filter(user_id=user_id).order_by("-issued_at")[:200]
        ],
    }


def _usage() -> list[dict]:
    from datetime import timedelta

    from django.utils import timezone

    from platform_auth.models import User

    now = timezone.now()
    users = User.objects.all()
    return [
        {"label": "Users", "value": users.count()},
        {"label": "Signed in, last 7 days", "value": users.filter(last_login_at__gte=now - timedelta(days=7)).count()},
        {"label": "Signed in, last 30 days", "value": users.filter(last_login_at__gte=now - timedelta(days=30)).count()},
        {"label": "New, last 7 days", "value": users.filter(created_at__gte=now - timedelta(days=7)).count()},
        {"label": "Disabled", "value": users.filter(is_active=False).count()},
        {"label": "Email not confirmed", "value": users.filter(email_verified_at__isnull=True).count()},
    ]
