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
            "weight_lb",
            "length_in",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_weight_lb(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Weight must be greater than zero.")
        return value

    def validate_length_in(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Length must be greater than zero.")
        return value
