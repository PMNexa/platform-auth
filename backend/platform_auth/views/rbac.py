"""RBAC resources - plain `BaseViewSet`s, so they get generic CRUD screens
and are themselves guarded by RBAC (`roles.update`, `users.view`, ...).
"""

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated

from core_api.viewsets import BaseViewSet
from platform_auth.models import Permission, Role, RoleAssignment, User
from platform_auth.serializers.rbac import (
    PermissionSerializer,
    RoleAssignmentSerializer,
    RoleSerializer,
    UserAccountSerializer,
)


class PermissionViewSet(BaseViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    http_method_names = ["get", "head", "options"]
    search_fields = ["codename", "label"]
    permission_classes = [IsAuthenticated]


class RoleViewSet(BaseViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    search_fields = ["name"]
    permission_classes = [IsAuthenticated]


class RoleAssignmentViewSet(BaseViewSet):
    """Scoped by `scope_id`: a role held within a scope that grants
    `role-assignments.*` lets its holder manage assignments in that scope
    only - an app-wide assignment always needs app-wide rights."""

    queryset = RoleAssignment.objects.select_related("role").order_by("-created_at")
    serializer_class = RoleAssignmentSerializer
    permission_classes = [IsAuthenticated]
    scope_field = "scope_id"

    def _resolve(self, model, name):
        value = self.request.data.get(name)
        if not value:
            raise ValidationError({name: ["This field is required."]})
        return get_object_or_404(model, id=value)

    def perform_create(self, serializer):
        user, role = self._resolve(User, "user"), self._resolve(Role, "role")
        if RoleAssignment.objects.filter(user=user, role=role, scope_id=serializer.validated_data.get("scope_id")).exists():
            raise ValidationError({"role": ["This user already has this role there."]})
        serializer.save(user=user, role=role)

    def perform_update(self, serializer):
        data = self.request.data
        instance = serializer.instance
        serializer.save(
            user=self._resolve(User, "user") if "user" in data else instance.user,
            role=self._resolve(Role, "role") if "role" in data else instance.role,
        )


class UserViewSet(BaseViewSet):
    """Accounts are created by signup, not here; this lists them, renames
    them and manages their role assignments (the detail page's tab)."""

    queryset = User.objects.order_by("name")
    serializer_class = UserAccountSerializer
    http_method_names = ["get", "patch", "head", "options"]
    search_fields = ["name", "email"]
    permission_classes = [IsAuthenticated]
