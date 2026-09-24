"""RBAC settings a host may set - every one optional, so the module works
in any project as is.

- `RBAC_DEFAULT_ROLES`: roles created on `migrate` when missing, each
  `{"name", "description"?, "is_default"?, "grants_all"?, "permissions"?}`
  where `permissions` are codename patterns (`"goals.*"`, `"*.view"`).
  Patterns are applied when the role is created and to permissions that
  appear later (a new resource) - never re-applied to existing ones, so
  an admin's edits stick.
- `RBAC_SCOPE_ENDPOINT`: the API of whatever a scope is (e.g.
  `"/api/v1/orgs"`) - gives `RoleAssignment.scope_id` a picker.
- `RBAC_SCOPE_LABEL`: what a scope is called in the UI.
"""

from django.conf import settings

DEFAULT_ROLES = [
    {"name": "Admin", "description": "Full access.", "grants_all": True},
    {"name": "Member", "description": "Given to every new user.", "is_default": True},
]


def default_roles() -> list[dict]:
    return getattr(settings, "RBAC_DEFAULT_ROLES", DEFAULT_ROLES)


def scope_endpoint() -> str | None:
    return getattr(settings, "RBAC_SCOPE_ENDPOINT", None)


def scope_label() -> str:
    return getattr(settings, "RBAC_SCOPE_LABEL", "Scope")
