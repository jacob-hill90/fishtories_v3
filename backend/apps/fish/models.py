from django.db import models


class FishSpecies(models.Model):
    """Shared species reference data, not a user's private catch records."""

    common_name = models.CharField(max_length=120, unique=True)
    scientific_name = models.CharField(max_length=160, blank=True)

    class Meta:
        ordering = ("common_name",)
        verbose_name_plural = "Fish species"

    def __str__(self):
        return self.common_name
