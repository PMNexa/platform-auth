"""GET /api/v1/auth/me."""

from rest_framework.response import Response
from rest_framework.views import APIView

from core_api.errors import Unauthorized
from platform_auth.rbac.policy import grants_for
from platform_auth.serializers import UserSerializer


class MeView(APIView):
    def get(self, request):
        if request.user is None:
            raise Unauthorized()
        # App-wide permission codenames, `["*"]` for a role granting all -
        # lets a UI hide what the user can't open (the API still enforces).
        codenames = grants_for(request).codenames()
        permissions = ["*"] if codenames is None else sorted(codenames)
        return Response({**UserSerializer(request.user).data, "permissions": permissions})
