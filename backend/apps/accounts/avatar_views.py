"""Private avatar read/upload/delete. No public /media URLs or direct storage links."""
import uuid

from django.db import transaction
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catches.photo_views import normalized_jpeg
from .views import public_user


class AvatarView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        avatar = request.user.avatar
        if not avatar:
            raise Http404
        try:
            handle = avatar.storage.open(avatar.name, "rb")
        except (FileNotFoundError, OSError):
            raise Http404 from None
        response = FileResponse(handle, content_type="image/jpeg")
        response["Content-Disposition"] = 'inline; filename="profile-avatar.jpg"'
        response["Cache-Control"] = "private, no-store, max-age=0"
        response["X-Content-Type-Options"] = "nosniff"
        response["Cross-Origin-Resource-Policy"] = "same-origin"
        return response

    def post(self, request):
        upload = request.FILES.get("avatar")
        if upload is None:
            return Response({"avatar": ["Choose an image to upload."]}, status=400)
        try:
            content = normalized_jpeg(upload, max_side=512)
        except ValueError as exc:
            return Response({"avatar": [str(exc)]}, status=400)

        user = request.user
        old_name = user.avatar.name if user.avatar else None
        storage = user.avatar.storage
        # need to generate names ourselves. should never never trust an uploaded filename
        user.avatar.save(f"{uuid.uuid4().hex}.jpg", content, save=True)
        if old_name:
            transaction.on_commit(lambda: storage.delete(old_name))
        result = Response({"user": public_user(user)}, status=status.HTTP_200_OK)
        result["Cache-Control"] = "no-store"
        return result

    def delete(self, request):
        user = request.user
        if user.avatar:
            name = user.avatar.name
            storage = user.avatar.storage
            user.avatar = None
            user.save(update_fields=["avatar"])
            transaction.on_commit(lambda: storage.delete(name))
        result = Response({"user": public_user(user)})
        result["Cache-Control"] = "no-store"
        return result
