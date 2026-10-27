from django.db.models import QuerySet
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Catch
from .serializers import CatchSerializer, PublicCatchSerializer


class CatchViewSet(ModelViewSet):
    """CRUD stays owner-only even if a catch has been shared publicly."""

    serializer_class = CatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> QuerySet:
        return Catch.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="public")
    def public(self, request):
        """A small, read-only community feed. Never reuse the owner's serializer."""
        shared = (
            Catch.objects.filter(
                is_public=True, latitude__isnull=False, longitude__isnull=False,
            )
            .order_by("-caught_at", "-pk")[:250]
        )
        response = Response(PublicCatchSerializer(shared, many=True).data)
        # A user might unpublish at any time; discourage cached old locations.
        response["Cache-Control"] = "no-store"
        return response
