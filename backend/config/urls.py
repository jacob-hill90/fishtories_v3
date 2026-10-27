"""Root API and admin URL definitions."""
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.catches.views import CatchViewSet
from config.views import health_check

router = DefaultRouter()
router.register("catches", CatchViewSet, basename="catch")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls")),  # optional DRF browsable-API login
]
