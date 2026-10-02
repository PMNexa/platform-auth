"""POST /api/v1/auth/login."""

from django.utils import timezone
from rest_framework.views import APIView

from core_api.errors import ApiError, InvalidCredentialsError
from core_api.system import audit
from platform_auth import lockout
from platform_auth.accounts import password_login_required, verification_required
from platform_auth.models import User
from platform_auth.security import verify_password_or_dummy
from platform_auth.serializers import LoginSerializer
from platform_auth.throttling import LoginEmailRateThrottle, LoginRateThrottle
from platform_auth.views._session import issue_session_response


class LoginView(APIView):
    authentication_classes = []
    throttle_classes = [LoginRateThrottle, LoginEmailRateThrottle]

    def post(self, request):
        password_login_required()
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        password = serializer.validated_data["password"]

        user = User.objects.filter(email=email).first()
        password_hash = user.password_hash if user is not None else None
        # While locked, the right password is refused too (`lockout.py`).
        if user is not None:
            lockout.check_not_locked(user, request)

        # Always runs the argon2 verify, even for a nonexistent email
        # (against a fixed dummy hash) - closes the user-enumeration
        # timing side-channel.
        if not verify_password_or_dummy(password, password_hash):
            audit("auth.login_failed", request=request, actor=None, target_label=email, reason="bad_credentials")
            if user is not None:
                lockout.record_failure(user, request)
            raise InvalidCredentialsError()
        # Only after the password matched - these don't reveal whether an
        # account exists to someone who doesn't know its password.
        if not user.is_active:
            audit("auth.login_failed", request=request, actor=user, target=user, reason="disabled")
            raise ApiError(403, "account_disabled", "This account is disabled. Contact an administrator.")
        if user.email_verified_at is None and verification_required():
            raise ApiError(403, "email_unverified", "Confirm your email first - check your inbox for the link.")

        User.objects.filter(id=user.id).update(last_login_at=timezone.now(), failed_login_count=0, locked_until=None)
        audit("auth.login", request=request, actor=user, target=user)
        return issue_session_response(user, request)
