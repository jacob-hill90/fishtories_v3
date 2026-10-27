from rest_framework import serializers

from .models import Catch


class CatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Catch
        fields = (
            "id",
            "species",
            "caught_at",
            "location_name",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
