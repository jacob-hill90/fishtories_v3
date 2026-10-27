from django.conf import settings
from django.db import models
from django.utils import timezone


class Catch(models.Model):
    """A private fishing journal entry owned by exactly one account."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="catches",
    )
    species = models.CharField(max_length=120)
    caught_at = models.DateTimeField(default=timezone.now)
    location_name = models.CharField(max_length=255, blank=True)
    # Keep measurements optional while the journal is taking shape.
    # Use explicit units rather than mixing inches/cm or pounds/kg.
    weight_lb = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    length_in = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-caught_at", "-id")

    def __str__(self):
        return f"{self.species} ({self.owner})"
