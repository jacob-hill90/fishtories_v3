from django.urls import path

from .views import csrf_token, current_user, dashboard, log_in, log_out, register

urlpatterns = [
    path("csrf/", csrf_token, name="auth-csrf"),
    path("register/", register, name="auth-register"),
    path("login/", log_in, name="auth-login"),
    path("logout/", log_out, name="auth-logout"),
    path("me/", current_user, name="auth-me"),
    path("dashboard/", dashboard, name="auth-dashboard"),
]
