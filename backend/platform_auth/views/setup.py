"""GET/POST /api/v1/auth/setup - first-run onboarding.

Until the first account exists, the app has no one to administer it:
`GET` reports whether setup is still needed, `POST` seeds the RBAC
catalog (permissions + default roles, same as `migrate` does), creates
the first user and gives them the admin role (`RBAC_ADMIN_ROLE`)
app-wide. Once any user exists, `POST` is refused for good - it can
never be used to claim admin on a running install.

A host where strangers sign up (a hosted/SaaS install) sets
`AUTH_FIRST_RUN_SETUP = False`: setup is then never required, `POST` is
refused, signup works from the first account on, and the operator's own
admin comes from `manage.py grant_role <email> Admin`.
"""

from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework.response import Response
from rest_framework.views import APIView

from core_api.errors import ConflictError
from platform_auth.models import Role, RoleAssignment, User
from platform_auth.rbac.catalog import sync_catalog
from platform_auth.rbac.settings import admin_role_name
from platform_auth.security import hash_password
from platform_auth.serializers import SignupSerializer
from platform_auth.views._session import issue_session_response


def setup_enabled() -> bool:
    return getattr(settings, "AUTH_FIRST_RUN_SETUP", True)


def setup_required() -> bool:
    return setup_enabled() and not User.objects.exists()


class SetupView(APIView):
    authentication_classes = []

    def get(self, request):
        return Response({"required": setup_required()})

    def post(self, request):
        if not setup_enabled():
            raise ConflictError("setup_disabled", "First-run setup is turned off here - sign up instead.")
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            sync_catalog()
            # The admin role's row lock serializes concurrent setups: the
            # loser waits, then sees the winner's user and is refused.
            role, _ = Role.objects.get_or_create(
                name=admin_role_name(), defaults={"description": "Full access.", "grants_all": True}
            )
            role = Role.objects.select_for_update().get(pk=role.pk)
            if not setup_required():
                raise ConflictError("setup_done", "This app is already set up - log in instead.")
            try:
                user = User.objects.create(
                    name=data["name"],
                    email=data["email"].lower(),
                    password_hash=hash_password(data["password"]),
                )
            except IntegrityError as exc:
                raise ConflictError("email_taken", "An account with this email already exists.") from exc
            RoleAssignment.objects.get_or_create(user=user, role=role, scope_id=None)

        return issue_session_response(user)
