from django.db.models import Q
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from .models import FishSpecies
from .serializers import FishSpeciesSerializer


class FishSpeciesList(ListAPIView):
    """Public, read-only species suggestions; never exposes private catches."""

    serializer_class = FishSpeciesSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        query = self.request.query_params.get("q", "").strip()[:80]
        species = FishSpecies.objects.all()
        if query:
            species = species.filter(
                Q(common_name__icontains=query) | Q(scientific_name__icontains=query)
            )
        return species[:75]
