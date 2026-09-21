from django.urls import path

from platform_auth.views import LoginView, MeView, SignupView

urlpatterns = [
    path("login", LoginView.as_view(), name="login"),
    path("signup", SignupView.as_view(), name="signup"),
    path("me", MeView.as_view(), name="me"),
]
