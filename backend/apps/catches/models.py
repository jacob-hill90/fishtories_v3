from django.conf import settings
from django.db import models
from django.utils import timezone


class Catch(models.Model):
    """Minimal private catch journal record; refine fields during v3 port."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="catches",
    )
    species = models.CharField(max_length=120)
    caught_at = models.DateTimeField(default=timezone.now)
    location_name = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-caught_at", "-id")

    def __str__(self):
        return f"{self.species} ({self.owner})"
