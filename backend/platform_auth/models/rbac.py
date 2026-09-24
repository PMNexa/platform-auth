"""Role-based access control. Enforced for every `BaseViewSet` resource
through platform-core's access-policy hook (`core_api/access.py`) by
`platform_auth.rbac.policy.RBACPolicy` - see this module's AGENTS.md.

- `Permission`: one `<resource>.<verb>` right (`goals.view`,
  `check-ins.delete`). Not created by hand - synced from every registered
  resource (`platform_auth.rbac.catalog`) on each `migrate`.
- `Role`: a named set of permissions (or `grants_all`).
- `RoleAssignment`: gives a user a role, app-wide (`scope_id` empty) or
  within one scope (`scope_id` set - what a scope is, e.g. an
  organization, is the host's choice: `RBAC_SCOPE_ENDPOINT`). A scoped
  role applies to rows whose resource's `scope_field` holds that id.
"""

from django.db import models
from django.db.models import Q

from core_api.utils import TimestampedModel, generate_uuid7
from platform_auth.models.user import User


class Permission(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    codename = models.CharField(max_length=128, unique=True)
    resource = models.CharField(max_length=100)
    verb = models.CharField(max_length=16)
    label = models.CharField(max_length=255)

    class Meta:
        db_table = "rbac_permission"
        ordering = ["codename"]

    def __str__(self):
        return self.codename


class Role(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default="")
    is_default = models.BooleanField(default=False, help_text="Given app-wide to every new user.")
    grants_all = models.BooleanField(default=False, help_text="Every permission, including ones added later.")
    permissions = models.ManyToManyField(Permission, related_name="roles", blank=True)

    class Meta:
        db_table = "rbac_role"
        ordering = ["name"]

    def __str__(self):
        return self.name


class RoleAssignment(TimestampedModel):
    id = models.UUIDField(primary_key=True, default=generate_uuid7, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id", related_name="role_assignments")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, db_column="role_id", related_name="assignments")
    scope_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="Empty: the role applies app-wide. Set: only within that scope.",
    )

    class Meta:
        db_table = "rbac_role_assignment"
        verbose_name = "role assignment"
        # Two constraints, not one over (user, role, scope_id): a unique
        # index treats NULLs as distinct, so an app-wide duplicate would
        # slip through one plain constraint (SQLite and Postgres alike).
        constraints = [
            models.UniqueConstraint(
                fields=["user", "role"], condition=Q(scope_id__isnull=True), name="uq_rbac_assignment_app_wide"
            ),
            models.UniqueConstraint(fields=["user", "role", "scope_id"], name="uq_rbac_assignment_scoped"),
        ]
