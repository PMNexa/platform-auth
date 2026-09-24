"""RBAC resources - mount at `api/v1/` (NOT under `auth/`): platform-core's
generic CRUD pages find a resource's API at `/api/v1/<its URL segment>`,
the platform's convention for every `BaseViewSet` resource."""

from rest_framework.routers import SimpleRouter

from core_api.registry import register_model_endpoint
from platform_auth.models import Permission, Role, RoleAssignment, User
from platform_auth.views.rbac import PermissionViewSet, RoleAssignmentViewSet, RoleViewSet, UserViewSet

router = SimpleRouter(trailing_slash=False)
router.register("users", UserViewSet, basename="users")
router.register("roles", RoleViewSet, basename="roles")
router.register("permissions", PermissionViewSet, basename="permissions")
router.register("role-assignments", RoleAssignmentViewSet, basename="role-assignments")
for model, endpoint in (
    (User, "/api/v1/users"),
    (Role, "/api/v1/roles"),
    (Permission, "/api/v1/permissions"),
    (RoleAssignment, "/api/v1/role-assignments"),
):
    register_model_endpoint(model, endpoint)

urlpatterns = router.urls
