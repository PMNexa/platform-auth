"""POST /api/v1/auth/signup - subject to the signup policy
(`accounts.signup_refusal`). When email verification is required the
account is created unverified and a link is emailed: the response is
201 `{verification_required: true, email}` and no session - the link
logs them in (`views/account.py`'s VerifyEmailView)."""

from django.db import IntegrityError
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from core_api.errors import ApiError, ConflictError
from core_api.system import audit
from platform_auth.accounts import send_verification, signup_refusal, verification_required
from platform_auth.models import User
from platform_auth.security import hash_password
from platform_auth.serializers import SignupSerializer
from platform_auth.throttling import SignupRateThrottle
from platform_auth.views._session import issue_session_response
from platform_auth.views.setup import setup_required


class SignupView(APIView):
    authentication_classes = []
    throttle_classes = [SignupRateThrottle]

    def post(self, request):
        # The first account goes through setup, which makes it the admin.
        if setup_required():
            raise ConflictError("setup_required", "This app isn't set up yet - create the admin account first.")
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"]
        email = serializer.validated_data["email"].lower()
        password = serializer.validated_data["password"]
        refusal = signup_refusal(email)
        if refusal:
            raise ApiError(403, *refusal)
        verify = verification_required()

        try:
            user = User.objects.create(
                name=name,
                email=email,
                password_hash=hash_password(password),
                email_verified_at=None if verify else timezone.now(),
            )
        except IntegrityError as exc:
            raise ConflictError("email_taken", "An account with this email already exists.") from exc

        audit("auth.signup", request=request, actor=user, target=user, verification_required=verify)
        if verify:
            send_verification(request, user)
            return Response({"verification_required": True, "email": user.email}, status=201)
        return issue_session_response(user, request)
