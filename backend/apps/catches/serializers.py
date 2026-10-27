from rest_framework import serializers

from .models import Catch


class CatchSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    def get_photo_url(self, obj):
        return f"/api/catches/{obj.pk}/photo/" if obj.photo else None

    class Meta:
        model = Catch
        fields = (
            "id",
            "species",
            "caught_at",
            "location_name",
            "weight_lb",
            "length_in",
            "latitude",
            "longitude",
            "is_public",
            "photo_url",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "photo_url", "created_at", "updated_at")

    def validate_weight_lb(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Weight must be greater than zero.")
        return value

    def validate_length_in(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Length must be greater than zero.")
        return value

    def validate(self, attrs):
        # Works for both a new catch and a PATCH that updates only one field.
        latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError({
                "coordinates": "Latitude and longitude must both be set or both be blank."
            })
        is_public = attrs.get("is_public", getattr(self.instance, "is_public", False))
        if is_public and (latitude is None or longitude is None):
            raise serializers.ValidationError({
                "coordinates": "Public catches need a map pin. Add coordinates or select Private."
            })
        return attrs


class PublicCatchSerializer(serializers.ModelSerializer):
    """Explicit allowlist for the public endpoint. Never serialize account data."""

    # Large stories can slow down a public map; keep previews a reasonable size.
    notes = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    def get_photo_url(self, obj):
        return f"/api/catches/{obj.pk}/photo/" if obj.photo else None

    class Meta:
        model = Catch
        fields = (
            "id", "species", "caught_at", "location_name", "weight_lb",
            "length_in", "latitude", "longitude", "notes", "photo_url",
        )
        read_only_fields = fields

    def get_notes(self, obj):
        return obj.notes[:1000]
