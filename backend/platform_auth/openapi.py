"""How platform_auth's authentication appears in an OpenAPI document
(drf-spectacular, via platform-core). Registered by being imported -
`PlatformAuthConfig.ready`."""

from drf_spectacular.extensions import OpenApiAuthenticationExtension


class ActorAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "platform_auth.authentication.ActorAuthentication"
    name = "bearerAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "The `access_token` from `POST /api/v1/auth/login` (15 minutes; "
            "`POST /api/v1/auth/refresh` with the refresh cookie for a new one).",
        }
