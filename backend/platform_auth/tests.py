"""RBAC tests - need a host with `CORE_API_ACCESS_POLICY` set to
`platform_auth.rbac.policy.RBACPolicy` and the RBAC urls mounted at
`api/v1/` (apps/main: `python manage.py test platform_auth`). Only this
module's own resources are used, so they hold in any such host."""

import uuid

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from platform_auth.models import Permission, Role, RoleAssignment, User
from platform_auth.rbac.catalog import sync_catalog


@override_settings(CORE_API_ACCESS_POLICY="platform_auth.rbac.policy.RBACPolicy")
class RBACTests(TestCase):
    def setUp(self):
        sync_catalog()
        self.admin_role = Role.objects.get_or_create(name="T-Admin", defaults={"grants_all": True})[0]
        self.scoped_admin = Role.objects.create(name="T-Assigner")
        self.scoped_admin.permissions.add(*Permission.objects.filter(resource="role-assignments"))
        self.admin = self.user("admin")
        RoleAssignment.objects.create(user=self.admin, role=self.admin_role)

    def user(self, name, roles=False):
        user = User.objects.create(name=name, email=f"{name}-{uuid.uuid4().hex[:6]}@t.io", password_hash="x")
        if not roles:
            RoleAssignment.objects.filter(user=user).delete()
        return user

    def client_for(self, user):
        client = APIClient(HTTP_HOST="localhost")
        client.force_authenticate(user)
        return client

    def test_catalog_has_a_permission_per_verb(self):
        self.assertEqual(
            set(Permission.objects.filter(resource="roles").values_list("verb", flat=True)),
            {"view", "create", "update", "delete"},
        )

    def test_new_user_gets_default_roles(self):
        default = Role.objects.create(name="T-Default", is_default=True)
        user = User.objects.create(name="n", email="n@t.io", password_hash="x")
        self.assertTrue(RoleAssignment.objects.filter(user=user, role=default, scope_id=None).exists())

    def test_no_role_denied(self):
        self.assertEqual(self.client_for(self.user("nobody")).get("/api/v1/roles").status_code, 403)

    def test_grants_all(self):
        self.assertEqual(self.client_for(self.admin).get("/api/v1/roles").status_code, 200)

    def test_users_never_expose_password_hash(self):
        rows = self.client_for(self.admin).get("/api/v1/users").json()["items"]
        self.assertTrue(rows)
        self.assertTrue(all("password_hash" not in row for row in rows))

    def test_scoped_role_is_limited_to_its_scope(self):
        scope, other = uuid.uuid4(), uuid.uuid4()
        assigner = self.user("assigner")
        RoleAssignment.objects.create(user=assigner, role=self.scoped_admin, scope_id=scope)
        target = self.user("target")
        client = self.client_for(assigner)
        body = {"user": str(target.id), "role": str(self.scoped_admin.id)}
        self.assertEqual(client.post("/api/v1/role-assignments", {**body, "scope_id": str(scope)}, format="json").status_code, 201)
        self.assertEqual(client.post("/api/v1/role-assignments", {**body, "scope_id": str(other)}, format="json").status_code, 403)
        # App-wide needs app-wide rights - and the denied row is rolled back.
        self.assertEqual(client.post("/api/v1/role-assignments", body, format="json").status_code, 403)
        self.assertFalse(RoleAssignment.objects.filter(user=target, scope_id=None).exists())
        scopes = {row["scope_id"] for row in client.get("/api/v1/role-assignments").json()["items"]}
        self.assertEqual(scopes, {str(scope)})

    def test_schema_reports_capabilities(self):
        viewer = Role.objects.create(name="T-Viewer")
        viewer.permissions.add(Permission.objects.get(codename="roles.view"))
        user = self.user("viewer")
        RoleAssignment.objects.create(user=user, role=viewer)
        can = self.client_for(user).get("/api/v1/roles/schema").json()["can"]
        self.assertEqual(can, {"create": False, "update": False, "delete": False})
        self.assertFalse(self.client_for(self.admin).get("/api/v1/permissions/schema").json()["can"]["create"])

    def test_me_lists_permissions(self):
        self.assertEqual(self.client_for(self.admin).get("/api/v1/auth/me").json()["permissions"], ["*"])
