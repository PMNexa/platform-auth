"""Email links, all public (no login):

- `POST auth/verify-email` `{token}` - confirms the email from the
  signup link and logs in.
- `POST auth/resend-verification` `{email}` - another link (always 204).
- `POST auth/password/forgot` `{email}` - emails a reset link if the
  account exists and is active (always 204, so it can't be used to find
  out which emails have accounts).
- `POST auth/password/reset` `{token, password}` - sets the password
  (also confirms the email - the link proved it), ends every other
  session, and logs in.

And the signed-in user's own account: `POST auth/me/password`
`{current_password, new_password}`, `GET auth/me/export` (a JSON
download of everything every module holds about them) and `POST
auth/me/delete` `{password}` (erase the account and what they own).
"""

from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from django.conf import settings

from core_api.errors import ApiError
from core_api.system import audit, export_user_data
from platform_auth import sso
from platform_auth.accounts import (
    is_last_admin,
    password_login_required,
    send_notice,
    send_password_reset,
    send_verification,
)
from platform_auth.models import User
from platform_auth.passwords import check_password
from platform_auth.security import hash_password, verify_password_or_dummy
from platform_auth.throttling import SignupRateThrottle
from platform_auth.tokens import RESET, VERIFY, read_token
from platform_auth.views._session import issue_session_response, revoke_all_sessions


class _EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class _TokenSerializer(serializers.Serializer):
    token = serializers.CharField()


class _ResetSerializer(_TokenSerializer):
    password = serializers.CharField(trim_whitespace=False)


def _invalid_link():
    return ApiError(400, "invalid_link", "This link is invalid or has expired. Ask for a new one.")


class VerifyEmailView(APIView):
    authentication_classes = []
    throttle_classes = [SignupRateThrottle]

    def post(self, request):
        password_login_required()
        serializer = _TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = read_token(serializer.validated_data["token"], VERIFY)
        if user is None:
            raise _invalid_link()
        if not user.is_active:
            raise ApiError(403, "account_disabled", "This account is disabled. Contact an administrator.")
        if user.email_verified_at is None:
            User.objects.filter(id=user.id).update(email_verified_at=timezone.now())
            audit("auth.email_verified", request=request, actor=user, target=user)
        return issue_session_response(user, request)


class ResendVerificationView(APIView):
    authentication_classes = []
    throttle_classes = [SignupRateThrottle]

    def post(self, request):
        serializer = _EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(email=serializer.validated_data["email"].lower(), is_active=True).first()
        if user is not None and user.email_verified_at is None:
            send_verification(request, user, request.data.get("next", ""))
        return Response(status=204)


class ForgotPasswordView(APIView):
    authentication_classes = []
    throttle_classes = [SignupRateThrottle]

    def post(self, request):
        serializer = _EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        user = User.objects.filter(email=email, is_active=True).first()
        # Single sign-on only: no link (a reset would be refused), same answer.
        if user is not None and sso.password_login_enabled():
            send_password_reset(request, user)
        audit("auth.password_reset_requested", request=request, actor=None, target_label=email, found=user is not None)
        return Response(status=204)


class ResetPasswordView(APIView):
    authentication_classes = []
    throttle_classes = [SignupRateThrottle]

    def post(self, request):
        # A reset signs in - not a way around single sign-on.
        password_login_required()
        serializer = _ResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = read_token(serializer.validated_data["token"], RESET)
        if user is None:
            raise _invalid_link()
        if not user.is_active:
            raise ApiError(403, "account_disabled", "This account is disabled. Contact an administrator.")
        check_password(serializer.validated_data["password"], email=user.email)
        user.password_hash = hash_password(serializer.validated_data["password"])
        user.email_verified_at = user.email_verified_at or timezone.now()
        user.last_login_at = timezone.now()
        # The link proved who they are - it also ends a lock from wrong passwords.
        user.failed_login_count, user.locked_until = 0, None
        user.save(update_fields=["password_hash", "email_verified_at", "last_login_at", "failed_login_count",
                                 "locked_until", "updated_at"])
        revoke_all_sessions(user, "password_reset")
        audit("auth.password_reset", request=request, actor=user, target=user)
        send_notice(user, "Your password was changed",
                    "Your GoalNexa password was just changed, and you were logged out everywhere else.\n\n"
                    "If this wasn't you, contact your administrator right away.", "password_changed")
        return issue_session_response(user, request)


class _PasswordSerializer(serializers.Serializer):
    password = serializers.CharField(trim_whitespace=False)


class _ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(trim_whitespace=False)


class ChangeMyPasswordView(APIView):
    """`POST auth/me/password` `{current_password, new_password}` - sets
    the caller's password, ends every other session, and answers with a
    fresh one (like a reset) so this browser stays logged in."""

    throttle_classes = [SignupRateThrottle]

    def post(self, request):
        if request.user is None or getattr(request.user, "impersonated_by", None):
            raise ApiError(403, "forbidden", "Change your own password from your own session.")
        serializer = _ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not verify_password_or_dummy(serializer.validated_data["current_password"], user.password_hash):
            raise ApiError(400, "wrong_password", "That's not your current password.")
        check_password(serializer.validated_data["new_password"], email=user.email, field="new_password")
        user.password_hash = hash_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password_hash", "updated_at"])
        revoke_all_sessions(user, "password_changed")
        audit("auth.password_changed", request=request, actor=user, target=user)
        send_notice(user, "Your password was changed",
                    "Your GoalNexa password was just changed, and you were logged out everywhere else.\n\n"
                    "If this wasn't you, contact your administrator right away.", "password_changed")
        return issue_session_response(user, request)


class MyDataView(APIView):
    """`GET auth/me/export` - everything the instance holds about the
    caller, as a JSON download (GDPR access/portability): every module's
    part (`core_api.system.export_user_data`)."""

    def get(self, request):
        if request.user is None or getattr(request.user, "impersonated_by", None):
            raise ApiError(403, "forbidden", "Export your own data from your own session.")
        return export_response(request.user)


class DeleteMyAccountView(APIView):
    """`POST auth/me/delete` `{password}` - deletes the caller's account and
    everything they own (GDPR erasure). The last administrator can't."""

    def post(self, request):
        if request.user is None or getattr(request.user, "impersonated_by", None):
            raise ApiError(403, "forbidden", "Delete your own account from your own session.")
        serializer = _PasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not verify_password_or_dummy(serializer.validated_data["password"], user.password_hash):
            raise ApiError(400, "wrong_password", "That's not your password.")
        if is_last_admin(user):
            raise ApiError(400, "last_admin", "You're the last administrator - make someone else one first.")
        erase_account(user, request=request, transfer_to=None, action_name="user.deleted_self")
        response = Response(status=204)
        response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=f"{settings.URL_PREFIX}/api/v1/auth", samesite="Lax")
        return response


def export_response(user):
    from django.http import JsonResponse

    data = {
        "exported_at": timezone.now().isoformat(),
        "profile": {"id": str(user.id), "name": user.name, "email": user.email},
        **export_user_data(user.id),
    }
    response = JsonResponse(data, json_dumps_params={"indent": 2, "default": str})
    response["Content-Disposition"] = f'attachment; filename="goalnexa-data-{timezone.localdate()}.json"'
    return response


def erase_account(user, *, request, transfer_to, action_name: str) -> None:
    """Every module deals with what the user holds (`user_removed`), then
    the account goes - one transaction. Raises DRF's ValidationError when
    a module refuses."""
    from django.core.exceptions import ValidationError as DjangoValidationError
    from django.db import transaction
    from rest_framework.exceptions import ValidationError

    from core_api.system import session_providers, user_removed
    from platform_auth.models import RefreshToken

    label = f"{user.name} <{user.email}>"
    user_id = str(user.id)
    with transaction.atomic():
        try:
            user_removed.send(sender=User, user_id=user_id, transfer_to=str(transfer_to.id) if transfer_to else None)
        except DjangoValidationError as exc:
            raise ValidationError({"user": exc.messages}) from None
        for provider in session_providers():
            provider.revoke_all(user_id)
        RefreshToken.objects.filter(user=user).delete()
        user.delete()
    audit(action_name, request=request, actor=None if action_name == "user.deleted_self" else request.user,
          target_type="user", target_id=user_id, target_label=label,
          transferred_to=str(transfer_to.id) if transfer_to else None,
          transferred_to_email=transfer_to.email if transfer_to else None)
