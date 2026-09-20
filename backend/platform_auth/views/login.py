"""POST /api/v1/auth/login."""

from datetime import UTC, datetime, timedelta

from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView

from core_api.errors import InvalidCredentialsError
from platform_auth.models import RefreshToken, User
from platform_auth.security import (
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
    verify_password_or_dummy,
)
from platform_auth.serializers import LoginSerializer, UserSerializer


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

        access_token = create_access_token(str(user.id))

        raw_refresh_token = create_refresh_token()
        now = datetime.now(UTC)
        RefreshToken.objects.create(
            user=user,
            token_hash=hash_refresh_token(raw_refresh_token),
            issued_at=now,
            expires_at=now + timedelta(days=settings.JWT_REFRESH_TTL_DAYS),
        )

        response = Response(
            {
                "access_token": access_token,
                "token_type": "bearer",
                "user": UserSerializer(user).data,
            }
        )
        response.set_cookie(
            settings.REFRESH_COOKIE_NAME,
            raw_refresh_token,
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite="Lax",
            max_age=settings.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60,
            path="/api/v1/auth",
        )
        return response
