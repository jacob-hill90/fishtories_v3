from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from django.utils import timezone
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db import transaction


class Catch(models.Model):
    """A fishing journal entry owned by one account; shared only by opt-in."""

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
    # Optional precise coordinates. A name alone should never be geocoded automatically.
    # Store a pair or neither value; enforced by the API serializer.
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
        validators=[MinValueValidator(Decimal("-90")), MaxValueValidator(Decimal("90"))],
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
        validators=[MinValueValidator(Decimal("-180")), MaxValueValidator(Decimal("180"))],
    )
    # A catch is NEVER shared automatically; existing database rows migrate to False.
    # Exact coordinates and the story are visible publicly only after opting in.
    is_public = models.BooleanField(default=False, db_index=True)
    # Always stored in PRIVATE media storage. The API controls photo access.
    photo = models.ImageField(upload_to="private/catch_photos/", blank=True, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-caught_at", "-id")

    def __str__(self):
        return f"{self.species} ({self.owner})"


@receiver(post_delete, sender=Catch)
def delete_photo_after_catch_deletion(sender, instance, **kwargs):
    """Also clean media files when an account is deleted and cascades catches."""
    if instance.photo:
        path = instance.photo.name
        storage = instance.photo.storage
        transaction.on_commit(lambda: storage.delete(path))
