from django.urls import path

from login.views import (
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    PasswordRecoveryAPIView,
    RegisterAPIView,
)


urlpatterns = [
    path("register/", RegisterAPIView.as_view(), name="api-auth-register"),
    path("login/", LoginAPIView.as_view(), name="api-auth-login"),
    path("me/", MeAPIView.as_view(), name="api-auth-me"),
    path("recover-password/", PasswordRecoveryAPIView.as_view(), name="api-auth-recover-password"),
    path("logout/", LogoutAPIView.as_view(), name="api-auth-logout"),
]
