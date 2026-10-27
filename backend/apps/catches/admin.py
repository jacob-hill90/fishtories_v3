from django.contrib import admin

from .models import Catch


@admin.register(Catch)
class CatchAdmin(admin.ModelAdmin):
    list_display = ("species", "owner", "caught_at", "location_name", "is_public")
    list_filter = ("caught_at", "is_public")
    search_fields = ("species", "owner__username", "location_name")
