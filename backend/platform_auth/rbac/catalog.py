"""The permission catalog: one `Permission` per registered resource and
verb, plus the host's default roles (`rbac/settings.py`). Runs after every
`migrate` (see apps.py) and via `manage.py sync_rbac`; idempotent."""

from fnmatch import fnmatch

from django.db import transaction
from django.urls import get_resolver

from core_api.access import VERBS
from core_api.registry import registered_endpoints
from platform_auth.models import Permission, Role
from platform_auth.rbac.settings import default_roles


def _catalog() -> list[tuple[str, str, str]]:
    # Resources register their endpoint when their urls.py is imported.
    get_resolver().url_patterns  # noqa: B018 - forces the URLconf to load
    entries = []
    for model, endpoint in registered_endpoints().items():
        resource = endpoint.rstrip("/").rsplit("/", 1)[-1]
        plural = str(model._meta.verbose_name_plural)
        for verb in VERBS:
            entries.append((resource, verb, f"{verb.capitalize()} {plural}"))
    return entries


def _matches(codename: str, patterns: list[str]) -> bool:
    return any(fnmatch(codename, pattern) for pattern in patterns)


@transaction.atomic
def sync_catalog() -> dict[str, int]:
    new_permissions = []
    for resource, verb, label in _catalog():
        permission, created = Permission.objects.get_or_create(
            codename=f"{resource}.{verb}", defaults={"resource": resource, "verb": verb, "label": label}
        )
        if created:
            new_permissions.append(permission)

    new_roles = 0
    for spec in default_roles():
        role, created = Role.objects.get_or_create(
            name=spec["name"],
            defaults={
                "description": spec.get("description", ""),
                "is_default": spec.get("is_default", False),
                "grants_all": spec.get("grants_all", False),
            },
        )
        patterns = spec.get("permissions", [])
        if not patterns:
            continue
        # A new role gets every match; an existing one only new permissions.
        candidates = Permission.objects.all() if created else new_permissions
        role.permissions.add(*[p for p in candidates if _matches(p.codename, patterns)])
        new_roles += created
    return {"permissions": len(new_permissions), "roles": new_roles}
