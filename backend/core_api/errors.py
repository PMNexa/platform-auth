"""Plain ApiError classes - zero rest_framework imports (breaks a circular
import with DRF's lazy settings resolution -> ActorAuthentication -> here).
"""


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, field_errors: dict | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.field_errors = field_errors
        super().__init__(message)


class Unauthorized(ApiError):
    def __init__(self, message: str = "Invalid or expired access token."):
        super().__init__(401, "invalid_token", message)


class InvalidCredentialsError(ApiError):
    def __init__(self):
        super().__init__(401, "invalid_credentials", "Incorrect email or password.")


class NotFoundError(ApiError):
    def __init__(self, message: str = "Not found."):
        super().__init__(404, "not_found", message)


class ConflictError(ApiError):
    def __init__(self, code: str, message: str):
        super().__init__(409, code, message)
