"""Authenticated private catch photos and deliberately shared public photos.

Never expose Django MEDIA_URL or the underlying storage URL; checks are made for
EACH image request so unpublishing revokes future access even to old URLs.
"""
import io
import uuid
import warnings

from django.core.files.base import ContentFile
from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Catch

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_SOURCE_PIXELS = 20_000_000
MAX_IMAGE_SIDE = 2048
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


def normalized_jpeg(upload, *, max_side=MAX_IMAGE_SIDE):
    """Validate and re-encode into a small JPEG without EXIF/GPS/other metadata."""
    if not upload or upload.size == 0:
        raise ValueError("Choose a photo to upload.")
    if upload.size > MAX_UPLOAD_BYTES:
        raise ValueError("Photos must be smaller than 8 MB.")
    try:
        upload.seek(0)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(upload) as original:
                if original.format not in ALLOWED_FORMATS:
                    raise ValueError("Use a JPEG, PNG or WebP image.")
                if getattr(original, "n_frames", 1) != 1:
                    raise ValueError("Animated images are not supported.")
                if original.width * original.height > MAX_SOURCE_PIXELS:
                    raise ValueError("Image is too large in pixel dimensions.")
                # EXIF orientation must be applied BEFORE discarding metadata.
                original.load()
                oriented = ImageOps.exif_transpose(original)
                oriented.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
                if oriented.mode in ("RGBA", "LA") or "transparency" in oriented.info:
                    rgba = oriented.convert("RGBA")
                    flattened = Image.new("RGB", rgba.size, (255, 255, 255))
                    flattened.paste(rgba, mask=rgba.getchannel("A"))
                    oriented = flattened
                else:
                    oriented = oriented.convert("RGB")
                buffer = io.BytesIO()
                # No EXIF, ICC, XMP or source name supplied to encoder.
                oriented.save(buffer, format="JPEG", quality=84, optimize=True)
                return ContentFile(buffer.getvalue())
    except ValueError:
        raise
    except (OSError, UnidentifiedImageError, Image.DecompressionBombError,
            Image.DecompressionBombWarning, SyntaxError):
        raise ValueError("That file is not a valid supported image.") from None


class CatchPhotoView(APIView):
    # GET may be public, but only for a catch explicitly published with a pin.
    # POST / DELETE perform an explicit owner check. SessionAuthentication still
    # protects authenticated mutating requests with CSRF.
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def get_owned(self, request, pk):
        if not request.user.is_authenticated:
            # No anonymous changes, even when a catch is public.
            return None
        return get_object_or_404(Catch, pk=pk, owner=request.user)

    def get(self, request, pk):
        item = get_object_or_404(Catch, pk=pk)
        can_view = (
            (request.user.is_authenticated and item.owner_id == request.user.pk)
            or (item.is_public and item.latitude is not None and item.longitude is not None)
        )
        if not can_view or not item.photo:
            raise Http404
        try:
            file = item.photo.storage.open(item.photo.name, "rb")
        except (FileNotFoundError, OSError):
            raise Http404 from None
        response = FileResponse(file, content_type="image/jpeg")
        response["Content-Disposition"] = 'inline; filename="catch-photo.jpg"'
        response["Cache-Control"] = "private, no-store, max-age=0"
        response["X-Content-Type-Options"] = "nosniff"
        response["Cross-Origin-Resource-Policy"] = "same-origin"
        return response

    def post(self, request, pk):
        item = self.get_owned(request, pk)
        if item is None:
            return Response({"detail": "Authentication required."}, status=status.HTTP_403_FORBIDDEN)
        uploaded = request.FILES.get("photo")
        if not uploaded:
            return Response({"photo": ["Choose a photo to upload."]}, status=400)
        try:
            content = normalized_jpeg(uploaded)
        except ValueError as exc:
            return Response({"photo": [str(exc)]}, status=400)

        previous_name = item.photo.name if item.photo else None
        storage = item.photo.storage
        # Server-generated filenames, never a user-provided filename.
        item.photo.save(f"{uuid.uuid4().hex}.jpg", content, save=True)
        if previous_name:
            transaction.on_commit(lambda: storage.delete(previous_name))
        response = Response({"photo_url": f"/api/catches/{item.pk}/photo/"})
        response["Cache-Control"] = "no-store"
        return response

    def delete(self, request, pk):
        item = self.get_owned(request, pk)
        if item is None:
            return Response({"detail": "Authentication required."}, status=status.HTTP_403_FORBIDDEN)
        if item.photo:
            previous_name = item.photo.name
            storage = item.photo.storage
            item.photo = None
            item.save(update_fields=["photo", "updated_at"])
            transaction.on_commit(lambda: storage.delete(previous_name))
        return Response(status=status.HTTP_204_NO_CONTENT)
