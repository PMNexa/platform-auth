from django.urls import path

from platform_auth.views.account import ChangeMyPasswordView, DeleteMyAccountView, MyDataView
from platform_auth.views import (
    AuthConfigView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    ResendVerificationView,
    ResetPasswordView,
    SetupView,
    SignupView,
    SsoCallbackView,
    SsoStartView,
    VerifyEmailView,
)

urlpatterns = [
    path("login", LoginView.as_view(), name="login"),
    path("setup", SetupView.as_view(), name="setup"),
    path("signup", SignupView.as_view(), name="signup"),
    path("logout", LogoutView.as_view(), name="logout"),
    path("refresh", RefreshView.as_view(), name="refresh"),
    path("me", MeView.as_view(), name="me"),
    path("verify-email", VerifyEmailView.as_view(), name="verify-email"),
    path("resend-verification", ResendVerificationView.as_view(), name="resend-verification"),
    path("password/forgot", ForgotPasswordView.as_view(), name="password-forgot"),
    path("password/reset", ResetPasswordView.as_view(), name="password-reset"),
    path("me/password", ChangeMyPasswordView.as_view(), name="me-password"),
    path("me/export", MyDataView.as_view(), name="me-export"),
    path("me/delete", DeleteMyAccountView.as_view(), name="me-delete"),
    path("config", AuthConfigView.as_view(), name="config"),
    path("sso/start", SsoStartView.as_view(), name="sso-start"),
    path("sso/callback", SsoCallbackView.as_view(), name="sso-callback"),
]
