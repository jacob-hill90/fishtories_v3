from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from .models import Catch
from .serializers import CatchSerializer


class CatchViewSet(ModelViewSet):
    """Only ever read, update or delete the requesting user's catches."""

    serializer_class = CatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Catch.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
