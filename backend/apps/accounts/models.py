from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Define this now, even if no custom fields are needed yet.

    Switching the AUTH_USER_MODEL after real users and migrations exist is
    significantly more difficult than beginning with our own model.
    """

    pass
