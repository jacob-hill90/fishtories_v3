"""FishTories v3: registration, sessions, and a private dashboard endpoint."""

import json

from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.db.models.functions import Lower, Trim
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from apps.catches.models import Catch
from .serializers import RegisterSerializer


def public_user(user):
    """Only expose fields intended for the signed-in browser."""
    return {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "date_joined": user.date_joined.isoformat(),
    }


def read_json_object(request):
    try:
        value = json.loads(request.body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


@ensure_csrf_cookie
@require_GET
def csrf_token(request):
    """Create an anti-CSRF cookie and provide a masked token for POST requests."""
    return JsonResponse({"csrfToken": get_token(request)})


@csrf_protect
@require_POST
def register(request):
    data = read_json_object(request)
    if data is None:
        return JsonResponse({"detail": "Send a valid JSON object."}, status=400)

    serializer = RegisterSerializer(data=data)
    if not serializer.is_valid():
        return JsonResponse(serializer.errors, status=400)

    user = serializer.save()
    return JsonResponse(public_user(user), status=201)


@csrf_protect
@require_POST
def log_in(request):
    data = read_json_object(request)
    if data is None:
        return JsonResponse({"detail": "Send a valid JSON object."}, status=400)

    username = data.get("username")
    password = data.get("password")
    if not isinstance(username, str) or not isinstance(password, str):
        return JsonResponse({"detail": "Username and password are required."}, status=400)
    if not username or not password:
        return JsonResponse({"detail": "Username and password are required."}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid username or password."}, status=400)

    django_login(request, user)
    return JsonResponse(public_user(user))


@never_cache
@require_GET
def current_user(request):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)
    return JsonResponse(public_user(request.user))


@never_cache
@require_GET
def dashboard(request):
    """Only the session owner can see this dashboard; no user ID is accepted."""
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Not authenticated."}, status=401)

    catches = Catch.objects.filter(owner=request.user)
    species = (
        catches.exclude(species="")
        .annotate(normalized=Lower(Trim("species")))
        .values("normalized")
        .distinct()
        .count()
    )
    locations = (
        catches.exclude(location_name="")
        .annotate(normalized=Lower(Trim("location_name")))
        .values("normalized")
        .distinct()
        .count()
    )
    recent = [
        {
            "id": catch.pk,
            "species": catch.species,
            "caught_at": catch.caught_at.isoformat(),
            "location_name": catch.location_name,
        }
        for catch in catches.order_by("-caught_at", "-id")[:5]
    ]
    return JsonResponse({
        "user": public_user(request.user),
        "stats": {"total_catches": catches.count(), "species_count": species, "locations_count": locations},
        "recent_catches": recent,
    })


@csrf_protect
@require_POST
def log_out(request):
    django_logout(request)
    return JsonResponse({"detail": "Logged out."})
