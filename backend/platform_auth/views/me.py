"""GET /api/v1/auth/me - who's signed in; PATCH it to change their own
preferences (the UI `language`)."""

from django.conf import settings
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from core_api.errors import ApiError, Unauthorized
from platform_auth.rbac.policy import grants_for
from platform_auth.models import User
from platform_auth.serializers import UserSerializer


def language_codes() -> list[str]:
    """The languages a user may pick: the host's `LANGUAGES`."""
    return [code for code, _name in getattr(settings, "LANGUAGES", [("en", "English")])]


def request_language(request) -> str:
    """The language a request was made in (Django's `LocaleMiddleware`:
    the language cookie, else Accept-Language) - a new account starts in
    it. Blank without the middleware or for an unlisted language."""
    code = getattr(request, "LANGUAGE_CODE", "") or ""
    return code if code in language_codes() else ""


class _MePatchSerializer(serializers.Serializer):
    language = serializers.CharField(allow_blank=True, max_length=10, help_text="One of the instance's languages, or blank for the browser's.")

    def validate_language(self, value):
        if value and value not in language_codes():
            raise serializers.ValidationError(f"Not a supported language: {', '.join(language_codes())}.")
        return value


class MeView(APIView):
    def get(self, request):
        if request.user is None:
            raise Unauthorized()
        # App-wide permission codenames, `["*"]` for a role granting all -
        # lets a UI hide what the user can't open (the API still enforces).
        codenames = grants_for(request).codenames()
        permissions = ["*"] if codenames is None else sorted(codenames)
        data = {**UserSerializer(request.user).data, "permissions": permissions}
        admin_id = getattr(request.user, "impersonated_by", None)
        if admin_id:
            admin = User.objects.filter(id=admin_id).values("id", "name", "email").first()
            data["impersonated_by"] = {**admin, "id": str(admin["id"])} if admin else {"id": admin_id}
        return Response(data)

    def patch(self, request):
        """Changes the caller's own preferences - only the fields sent."""
        if request.user is None:
            raise Unauthorized()
        if getattr(request.user, "impersonated_by", None):
            raise ApiError(403, "forbidden", "Change your own preferences from your own session.")
        serializer = _MePatchSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        fields = list(serializer.validated_data)
        for field, value in serializer.validated_data.items():
            setattr(request.user, field, value)
        if fields:
            request.user.save(update_fields=[*fields, "updated_at"])
        return Response(UserSerializer(request.user).data)
