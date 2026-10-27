from django.contrib import admin

from .models import FishSpecies


@admin.register(FishSpecies)
class FishSpeciesAdmin(admin.ModelAdmin):
    list_display = ("common_name", "scientific_name")
    search_fields = ("common_name", "scientific_name")
    ordering = ("common_name",)
