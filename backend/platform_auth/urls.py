from django.urls import path

from platform_auth.views import LoginView, LogoutView, MeView, RefreshView, SetupView, SignupView

urlpatterns = [
    path("login", LoginView.as_view(), name="login"),
    path("setup", SetupView.as_view(), name="setup"),
    path("signup", SignupView.as_view(), name="signup"),
    path("logout", LogoutView.as_view(), name="logout"),
    path("refresh", RefreshView.as_view(), name="refresh"),
    path("me", MeView.as_view(), name="me"),
]
