from django.urls import path

from platform_auth.views import LoginView, LogoutView, MeView, RefreshView, SignupView

urlpatterns = [
    path("login", LoginView.as_view(), name="login"),
    path("signup", SignupView.as_view(), name="signup"),
    path("logout", LogoutView.as_view(), name="logout"),
    path("refresh", RefreshView.as_view(), name="refresh"),
    path("me", MeView.as_view(), name="me"),
]
