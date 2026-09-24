from rest_framework import serializers

from core_api.serializers import BaseSerializer, DynamicRelationField
from platform_auth.models import Permission, Role, RoleAssignment, User
from platform_auth.rbac.settings import scope_endpoint, scope_label


class PermissionSerializer(BaseSerializer):
    """Read-only - permissions are synced from the registered resources
    (rbac/catalog.py), never created by hand."""

    class Meta:
        model = Permission
        auto_exclude = ["created_at", "updated_at"]
        read_only_fields = ["codename", "resource", "verb", "label"]


class RoleSerializer(BaseSerializer):
    """`permissions` (many-to-many, linked from the role's detail page) and
    `assignments` are auto-added and deferred by `BaseSerializer`."""

    class Meta:
        model = Role
        auto_exclude = ["created_at", "updated_at"]


class RoleAssignmentSerializer(BaseSerializer):
    """`user`/`role` are read-only relation fields (this platform's rule -
    see core_api's BaseSerializer); the viewset resolves them from the
    request body. `summary` names the row in a UI."""

    summary = serializers.SerializerMethodField()
    user = DynamicRelationField(lambda: UserAccountSerializer)
    role = DynamicRelationField(RoleSerializer)

    class Meta:
        model = RoleAssignment
        # Explicit, for the form's order: who, what, where.
        fields = ["id", "summary", "user", "role", "scope_id", "created_at"]
        display_field = "summary"
        extra_kwargs = {"scope_id": {"label": scope_label()}}
        # Gives `scope_id` a picker when the host says what a scope is.
        related_endpoints = {"scope_id": scope_endpoint()} if scope_endpoint() else {}
        # The access policy decides who may assign in which scope (an
        # app-wide admin can in any org, member or not) - not whether the
        # caller could list that org, BaseViewSet's default check.
        unchecked_related_endpoints = {"scope_id"}

    def get_summary(self, obj) -> str:
        where = f"one {scope_label().lower()}" if obj.scope_id else "app-wide"
        return f"{obj.role.name} ({where})"


class UserAccountSerializer(BaseSerializer):
    """The `users` resource - an explicit field list, so nothing
    credential-shaped (`password_hash`) can ever be emitted. `email` is
    the login identity, so it's read-only here."""

    role_assignments = DynamicRelationField(RoleAssignmentSerializer, many=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "created_at", "role_assignments"]
        deferred_fields = ["role_assignments"]
        read_only_fields = ["email", "created_at"]
