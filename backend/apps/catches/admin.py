from django.contrib import admin

from .models import Catch


@admin.register(Catch)
class CatchAdmin(admin.ModelAdmin):
    list_display = ("species", "owner", "caught_at", "location_name")
    list_filter = ("caught_at",)
    search_fields = ("species", "owner__username", "location_name")
