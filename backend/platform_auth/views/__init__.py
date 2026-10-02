from platform_auth.views.account import ForgotPasswordView, ResendVerificationView, ResetPasswordView, VerifyEmailView
from platform_auth.views.login import LoginView
from platform_auth.views.logout import LogoutView
from platform_auth.views.me import MeView
from platform_auth.views.refresh import RefreshView
from platform_auth.views.setup import SetupView
from platform_auth.views.signup import SignupView
from platform_auth.views.sso import AuthConfigView, SsoCallbackView, SsoStartView

__all__ = [
    "AuthConfigView",
    "ForgotPasswordView",
    "LoginView",
    "LogoutView",
    "MeView",
    "RefreshView",
    "ResendVerificationView",
    "ResetPasswordView",
    "SetupView",
    "SignupView",
    "SsoCallbackView",
    "SsoStartView",
    "VerifyEmailView",
]
