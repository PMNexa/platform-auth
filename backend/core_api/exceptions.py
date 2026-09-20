"""DRF EXCEPTION_HANDLER - {code, message, field_errors} contract, matching
platform-core's own error shape so both services' frontends can share the
same API-error-handling code.
"""

from rest_framework import exceptions as drf_exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_default_exception_handler

from core_api.errors import ApiError

_STATUS_CODE_TO_GENERIC_CODE = {
    400: "bad_request",
    401: "invalid_token",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    429: "rate_limited",
    500: "internal_error",
}


def _flatten_drf_validation_error(exc: drf_exceptions.ValidationError) -> dict[str, list[str]]:
    field_errors: dict[str, list[str]] = {}
    detail = exc.detail
    if isinstance(detail, dict):
        for field, messages in detail.items():
            field_errors[str(field)] = [str(m) for m in messages] if isinstance(messages, list) else [str(messages)]
    elif isinstance(detail, list):
        field_errors["__root__"] = [str(m) for m in detail]
    else:
        field_errors["__root__"] = [str(detail)]
    return field_errors


def platform_auth_exception_handler(exc, context):
    if isinstance(exc, ApiError):
        return Response(
            {"code": exc.code, "message": exc.message, "field_errors": exc.field_errors},
            status=exc.status_code,
        )

    response = drf_default_exception_handler(exc, context)
    if response is None:
        return None

    if isinstance(exc, drf_exceptions.ValidationError):
        response.data = {
            "code": "validation_error",
            "message": "Request failed validation.",
            "field_errors": _flatten_drf_validation_error(exc),
        }
        return response

    detail = getattr(exc, "detail", None)
    message = str(detail) if detail is not None and not isinstance(detail, (list, dict)) else "Request failed."
    response.data = {
        "code": _STATUS_CODE_TO_GENERIC_CODE.get(response.status_code, "http_error"),
        "message": message,
        "field_errors": None,
    }
    return response
