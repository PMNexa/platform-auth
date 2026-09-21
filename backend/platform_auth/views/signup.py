"""POST /api/v1/auth/signup."""

from django.db import IntegrityError
from rest_framework.views import APIView

from core_api.errors import ConflictError
from platform_auth.models import User
from platform_auth.security import hash_password
from platform_auth.serializers import SignupSerializer
from platform_auth.views._session import issue_session_response


class SignupView(APIView):
    authentication_classes = []

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data["name"]
        email = serializer.validated_data["email"].lower()
        password = serializer.validated_data["password"]

        try:
            user = User.objects.create(
                name=name,
                email=email,
                password_hash=hash_password(password),
            )
        except IntegrityError as exc:
            raise ConflictError("email_taken", "An account with this email already exists.") from exc

        return issue_session_response(user)
