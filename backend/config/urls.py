"""Django API plus SPA entry points for the built Vite frontend."""
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from rest_framework.routers import DefaultRouter

from apps.catches.views import CatchViewSet
from apps.catches.photo_views import CatchPhotoView
from apps.fish.views import FishSpeciesList
from config.views import health_check

router = DefaultRouter()
router.register("catches", CatchViewSet, basename="catch")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/fish/", FishSpeciesList.as_view(), name="fish-list"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/catches/<int:pk>/photo/", CatchPhotoView.as_view(), name="catch-photo"),
    path("api/", include(router.urls)),
    # Explicit React routes, no catch-all on unknown URLs or /api/ paths.
    re_path(
        r"^(?:|login|register|profile|catches|fish|map|weather)$",
        TemplateView.as_view(template_name="index.html"),
        name="react-frontend",
    ),
]
