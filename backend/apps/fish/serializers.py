from rest_framework import serializers

from .models import FishSpecies


class FishSpeciesSerializer(serializers.ModelSerializer):
    class Meta:
        model = FishSpecies
        fields = ("id", "common_name", "scientific_name")
        read_only_fields = fields
