from django.contrib.auth.models import AbstractUser
from django.db import models, transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver


class User(AbstractUser):
    """Define this now, even if no custom fields are needed yet.

    Switching the AUTH_USER_MODEL after real users and migrations exist is
    significantly more difficult than beginning with our own model.
    """

    # Profile images are never served by a public /media/ route. Only the signed-in
    # user may retrieve this file through /api/auth/avatar/.
    avatar = models.ImageField(upload_to="private/profile_avatars/", blank=True, null=True)


@receiver(post_delete, sender=User)
def delete_avatar_after_user_deletion(sender, instance, **kwargs):
    if instance.avatar:
        path = instance.avatar.name
        storage = instance.avatar.storage
        transaction.on_commit(lambda: storage.delete(path))
