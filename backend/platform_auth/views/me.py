"""GET /api/v1/auth/me."""

from rest_framework.response import Response
from rest_framework.views import APIView

from core_api.errors import Unauthorized
from platform_auth.serializers import UserSerializer


class MeView(APIView):
    def get(self, request):
        if request.user is None:
            raise Unauthorized()
        return Response(UserSerializer(request.user).data)
