"""RBAC tests - need a host with `CORE_API_ACCESS_POLICY` set to
`platform_auth.rbac.policy.RBACPolicy` and the RBAC urls mounted at
`api/v1/` (apps/main: `python manage.py test platform_auth`). Only this
module's own resources are used, so they hold in any such host."""

import uuid

from django.conf import settings
from django.core.cache import cache
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


@override_settings(CORE_API_ACCESS_POLICY="platform_auth.rbac.policy.RBACPolicy")
class SetupTests(TestCase):
    body = {"name": "Ada", "email": "Ada@T.io", "password": "correct-horse"}

    def setUp(self):
        self.client = APIClient(HTTP_HOST="localhost")

    def test_first_user_becomes_admin(self):
        self.assertTrue(self.client.get("/api/v1/auth/setup").json()["required"])
        response = self.client.post("/api/v1/auth/setup", self.body, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.json())
        user = User.objects.get(email="ada@t.io")
        self.assertTrue(RoleAssignment.objects.filter(user=user, role__name="Admin", scope_id=None).exists())
        self.assertTrue(Permission.objects.filter(codename="roles.view").exists())
        self.assertFalse(self.client.get("/api/v1/auth/setup").json()["required"])

    def test_setup_only_once(self):
        self.client.post("/api/v1/auth/setup", self.body, format="json")
        again = self.client.post("/api/v1/auth/setup", {**self.body, "email": "eve@t.io"}, format="json")
        self.assertEqual(again.status_code, 409)
        self.assertEqual(again.json()["code"], "setup_done")
        self.assertFalse(User.objects.filter(email="eve@t.io").exists())

    def test_signup_waits_for_setup(self):
        response = self.client.post("/api/v1/auth/signup", self.body, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "setup_required")
        self.client.post("/api/v1/auth/setup", self.body, format="json")
        second = self.client.post("/api/v1/auth/signup", {**self.body, "email": "bob@t.io"}, format="json")
        self.assertEqual(second.status_code, 200)
        self.assertFalse(RoleAssignment.objects.filter(user__email="bob@t.io", role__name="Admin").exists())

    @override_settings(AUTH_FIRST_RUN_SETUP=False)
    def test_setup_disabled(self):
        self.assertFalse(self.client.get("/api/v1/auth/setup").json()["required"])
        refused = self.client.post("/api/v1/auth/setup", self.body, format="json")
        self.assertEqual(refused.status_code, 409)
        self.assertEqual(refused.json()["code"], "setup_disabled")
        first = self.client.post("/api/v1/auth/signup", self.body, format="json")
        self.assertEqual(first.status_code, 200)
        self.assertFalse(RoleAssignment.objects.filter(user__email="ada@t.io", role__name="Admin").exists())


def throttle_rates(**rates):
    """The host's REST_FRAMEWORK with only these auth rates set."""
    return {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}


@override_settings(
    AUTH_FIRST_RUN_SETUP=False,
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "throttle-tests"}},
)
class ThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient(HTTP_HOST="localhost")
        self.client.post("/api/v1/auth/signup", {"name": "Ada", "email": "ada@t.io", "password": "correct-horse"}, format="json")
        cache.clear()

    def login(self, email="ada@t.io", ip="10.0.0.1"):
        return self.client.post(
            "/api/v1/auth/login", {"email": email, "password": "wrong-horse"}, format="json", REMOTE_ADDR=ip
        )

    def test_login_limited_per_ip(self):
        with override_settings(REST_FRAMEWORK=throttle_rates(auth_login="2/min")):
            self.assertEqual(self.login().status_code, 401)
            self.assertEqual(self.login(email="bob@t.io").status_code, 401)
            limited = self.login(email="eve@t.io")
            self.assertEqual(limited.status_code, 429)
            self.assertEqual(limited.json()["code"], "rate_limited")
            self.assertIn("Retry-After", limited.headers)
            self.assertEqual(self.login(ip="10.0.0.2").status_code, 401)

    def test_login_limited_per_email_across_ips(self):
        with override_settings(REST_FRAMEWORK=throttle_rates(auth_login_email="2/min")):
            self.assertEqual(self.login(ip="10.0.0.1").status_code, 401)
            self.assertEqual(self.login(email="ADA@t.io", ip="10.0.0.2").status_code, 401)
            self.assertEqual(self.login(ip="10.0.0.3").status_code, 429)
            self.assertEqual(self.login(email="bob@t.io", ip="10.0.0.3").status_code, 401)

    def test_signup_limited_per_ip(self):
        with override_settings(REST_FRAMEWORK=throttle_rates(auth_signup="1/min")):
            body = {"name": "Bob", "email": "bob@t.io", "password": "correct-horse"}
            self.assertEqual(self.client.post("/api/v1/auth/signup", body, format="json").status_code, 200)
            again = self.client.post("/api/v1/auth/signup", {**body, "email": "eve@t.io"}, format="json")
            self.assertEqual(again.status_code, 429)
            self.assertEqual(self.client.get("/api/v1/auth/setup").status_code, 200)

    def test_no_rate_means_no_limit(self):
        with override_settings(REST_FRAMEWORK=throttle_rates()):
            for _ in range(5):
                self.assertEqual(self.login().status_code, 401)
