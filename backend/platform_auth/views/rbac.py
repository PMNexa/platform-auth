"""RBAC resources - plain `BaseViewSet`s, so they get generic CRUD screens
and are themselves guarded by RBAC (`roles.update`, `users.view`, ...).
"""

from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core_api.errors import ConflictError
from core_api.system import audit, session_providers
from platform_auth.accounts import is_last_admin, reset_url, send_invitation, send_notice
from platform_auth.models import UNUSABLE_PASSWORD, RefreshToken
from platform_auth.security import create_access_token
from platform_auth.views._session import revoke_all_sessions
from platform_auth.views.account import erase_account, export_response

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

    def perform_create(self, serializer):
        role = serializer.save()
        audit("role.created", request=self.request, target=role)

    def perform_update(self, serializer):
        role = serializer.save()
        audit("role.updated", request=self.request, target=role, fields=sorted(self.request.data.keys()))

    def perform_destroy(self, instance):
        if instance.grants_all and RoleAssignment.objects.filter(role=instance, scope_id__isnull=True).exists():
            raise ValidationError({"role": ["Administrators hold this role - it can't be deleted."]})
        audit("role.deleted", request=self.request, target=instance)
        instance.delete()

    # Re-declared (an override drops the base class's @action) to audit
    # permission changes.
    @action(detail=True, methods=["post"], url_path=r"relations/(?P<relation_name>\w+)/link")
    def link(self, request, pk=None, relation_name=None):
        response = BaseViewSet.link(self, request, pk=pk, relation_name=relation_name)
        audit("role.permissions_added", request=request, target=self.get_object(), relation=relation_name,
              ids=request.data.get("ids"))
        return response

    @action(detail=True, methods=["post"], url_path=r"relations/(?P<relation_name>\w+)/unlink")
    def unlink(self, request, pk=None, relation_name=None):
        response = BaseViewSet.unlink(self, request, pk=pk, relation_name=relation_name)
        audit("role.permissions_removed", request=request, target=self.get_object(), relation=relation_name,
              ids=request.data.get("ids"))
        return response


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
        assignment = serializer.save(user=user, role=role)
        _audit_assignment(self.request, "role.assigned", assignment)

    def _guard_last_admin(self, assignment):
        if assignment.scope_id is None and assignment.role.grants_all and is_last_admin(assignment.user):
            raise ValidationError({"role": ["This is the last administrator - make someone else one first."]})

    def perform_update(self, serializer):
        data = self.request.data
        instance = serializer.instance
        self._guard_last_admin(instance)
        assignment = serializer.save(
            user=self._resolve(User, "user") if "user" in data else instance.user,
            role=self._resolve(Role, "role") if "role" in data else instance.role,
        )
        _audit_assignment(self.request, "role.assignment_changed", assignment)

    def perform_destroy(self, instance):
        self._guard_last_admin(instance)
        _audit_assignment(self.request, "role.unassigned", instance)
        instance.delete()


def _audit_assignment(request, action_name, assignment):
    audit(action_name, request=request, target=assignment.user, role=assignment.role.name,
          scope_id=str(assignment.scope_id) if assignment.scope_id else None)


class _InviteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()


class UserViewSet(BaseViewSet):
    """Accounts come from signup or an admin's invitation; this lists
    them, renames them, manages their role assignments (the detail page's
    tab) and runs the admin's account actions. Each is guarded by RBAC
    like the resource itself (`users.create` for invite, `users.delete`
    for delete, `users.update` for the rest) and audited:

    - `POST users/invite` `{name, email}` - an account with no password;
      the email (and the response) carries a 3-day set-password link.
    - `POST users/<id>/disable` | `/enable` - a disabled user can't log
      in, and every session and token of theirs ends now.
    - `POST users/<id>/unlock` - ends a lock from too many wrong passwords.
    - `POST users/<id>/reset-link` - a 3-day password link to hand over.
    - `GET users/<id>/sessions`, `POST users/<id>/revoke-sessions` - their
      logins and other credentials (`core_api.system` session providers,
      e.g. MCP tokens); revoking signs them out everywhere.
    - `DELETE users/<id>?transfer_to=<user id>` - every module hands what
      they own to `transfer_to`, or erases it without one
      (`core_api.system.user_removed`), then the account goes.
    - `GET users/<id>/export` - everything held about them (JSON).
    - `POST users/<id>/impersonate` - a 15-minute read-only token acting as
      them ("view as", for support).

    Nobody can disable or delete themselves, or the last administrator.
    """

    queryset = User.objects.order_by("name")
    serializer_class = UserAccountSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ["name", "email"]
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        raise ValidationError({"email": ["Invite a user instead (users/invite)."]})

    def _capabilities(self, request) -> dict:
        # Generic screens offer neither: accounts are invited (the list's
        # Invite card), and deleting one asks where their data goes (the
        # user page's panel) - never a one-click erase from a table row.
        return {**super()._capabilities(request), "create": False, "delete": False}

    def perform_update(self, serializer):
        before = serializer.instance.name
        user = serializer.save()
        if user.name != before:
            audit("user.renamed", request=self.request, target=user, before=before, after=user.name)

    def _guard(self, user, verb: str):
        if str(user.id) == str(self.request.user.id):
            raise ValidationError({"user": [f"You can't {verb} your own account."]})
        if is_last_admin(user):
            raise ValidationError({"user": [f"This is the last administrator - make someone else one before you {verb} it."]})

    @action(detail=False, methods=["post"])
    def invite(self, request):
        serializer = _InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.create(
                name=serializer.validated_data["name"],
                email=serializer.validated_data["email"].lower(),
                password_hash=UNUSABLE_PASSWORD,
            )
        except IntegrityError as exc:
            raise ConflictError("email_taken", "An account with this email already exists.") from exc
        url = send_invitation(request, user, request.user)
        audit("user.invited", request=request, target=user)
        return Response({**UserAccountSerializer(user).data, "set_password_url": url}, status=201)

    @action(detail=True, methods=["post"])
    def disable(self, request, pk=None):
        user = self.get_object()
        self._guard(user, "disable")
        if user.is_active:
            User.objects.filter(id=user.id).update(is_active=False)
            sessions = _revoke_everything(user)
            audit("user.disabled", request=request, target=user, sessions_revoked=sessions)
            send_notice(user, "Your account was disabled",
                        "An administrator disabled your GoalNexa account. Contact them if you think this is a mistake.",
                        "account_disabled")
        return Response(UserAccountSerializer(User.objects.get(id=user.id)).data)

    @action(detail=True, methods=["post"])
    def enable(self, request, pk=None):
        user = self.get_object()
        if not user.is_active:
            User.objects.filter(id=user.id).update(is_active=True)
            audit("user.enabled", request=request, target=user)
        return Response(UserAccountSerializer(User.objects.get(id=user.id)).data)

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        """Ends a lock from too many wrong passwords (`lockout.py`) now."""
        user = self.get_object()
        if user.locked_until or user.failed_login_count:
            User.objects.filter(id=user.id).update(failed_login_count=0, locked_until=None)
            audit("user.unlocked", request=request, target=user)
        return Response(UserAccountSerializer(User.objects.get(id=user.id)).data)

    @action(detail=True, methods=["post"], url_path="reset-link")
    def reset_link(self, request, pk=None):
        user = self.get_object()
        if not user.is_active:
            raise ValidationError({"user": ["Enable the account first."]})
        audit("user.reset_link_created", request=request, target=user)
        return Response({"url": reset_url(request, user, long=True), "expires_in_hours": 72})

    @action(detail=True, methods=["get"])
    def sessions(self, request, pk=None):
        user = self.get_object()
        now = timezone.now()
        logins = RefreshToken.objects.filter(user=user, revoked_at__isnull=True, expires_at__gt=now).order_by("-issued_at")
        return Response({
            "logins": [
                {"id": str(t.id), "started_at": t.issued_at, "expires_at": t.expires_at, "ip": t.ip,
                 "user_agent": t.user_agent}
                for t in logins
            ],
            "other": [
                {"kind": p.kind, "label": p.label, "items": p.list(str(user.id))} for p in session_providers()
            ],
        })

    @action(detail=True, methods=["post"], url_path="revoke-sessions")
    def revoke_sessions(self, request, pk=None):
        user = self.get_object()
        count = _revoke_everything(user)
        audit("user.sessions_revoked", request=request, target=user, revoked=count)
        return Response({"revoked": count})

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        self._guard(user, "delete")
        transfer_id = request.query_params.get("transfer_to") or request.data.get("transfer_to") or None
        transfer_to = None
        if transfer_id:
            transfer_to = User.objects.filter(id=transfer_id, is_active=True).first()
            if transfer_to is None or transfer_to.id == user.id:
                raise ValidationError({"transfer_to": ["Pick another active user to take over."]})
        erase_account(user, request=request, transfer_to=transfer_to, action_name="user.deleted")
        return Response(status=204)

    @action(detail=True, methods=["get"])
    def export(self, request, pk=None):
        """Everything the instance holds about this user, as a JSON download."""
        user = self.get_object()
        audit("user.data_exported", request=request, target=user)
        return export_response(user)

    @action(detail=True, methods=["post"])
    def impersonate(self, request, pk=None):
        """A 15-minute, read-only access token acting as this user - "view
        as", for support. Every write it attempts is refused; starting one
        is audited."""
        user = self.get_object()
        if str(user.id) == str(request.user.id):
            raise ValidationError({"user": ["That's you."]})
        if not user.is_active:
            raise ValidationError({"user": ["Enable the account first."]})
        audit("user.impersonated", request=request, target=user)
        token = create_access_token(str(user.id), expires_minutes=15, imp=str(request.user.id))
        return Response({"access_token": token, "expires_in": 900, "user": {"id": str(user.id), "name": user.name, "email": user.email}})


def _revoke_everything(user) -> int:
    """Every login session plus everything other modules issued (MCP tokens, ...)."""
    count = revoke_all_sessions(user, "admin")
    for provider in session_providers():
        count += provider.revoke_all(str(user.id))
    return count
