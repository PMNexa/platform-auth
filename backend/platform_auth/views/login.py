"""POST /api/v1/auth/login."""

from rest_framework.views import APIView

from core_api.errors import InvalidCredentialsError
from platform_auth.models import User
from platform_auth.security import verify_password_or_dummy
from platform_auth.serializers import LoginSerializer
from platform_auth.views._session import issue_session_response


class LoginView(APIView):
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        password = serializer.validated_data["password"]

        user = User.objects.filter(email=email).first()
        password_hash = user.password_hash if user is not None else None

        # Always runs the argon2 verify, even for a nonexistent email
        # (against a fixed dummy hash) - closes the user-enumeration
        # timing side-channel.
        if not verify_password_or_dummy(password, password_hash):
            raise InvalidCredentialsError()

        return issue_session_response(user)
