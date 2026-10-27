"""Milestone 8: permission-checked catch photos and safe image uploads."""
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from .models import Catch


def example_photo(fmt="PNG", width=120, height=80, exif=False):
    image = Image.new("RGB", (width, height), "#297864")
    buffer = BytesIO()
    options = {}
    if exif:
        data = Image.Exif()
        data[270] = "this metadata must not be retained"
        options["exif"] = data
    image.save(buffer, fmt, **options)
    return SimpleUploadedFile(
        f"catch.{fmt.lower()}", buffer.getvalue(), content_type=f"image/{fmt.lower()}",
    )


class PhotoAccessTests(TestCase):
    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.context = override_settings(MEDIA_ROOT=self.folder.name)
        self.context.enable()
        self.addCleanup(self.context.disable)
        users = get_user_model()
        self.owner = users.objects.create_user(username="photo_owner", password="password123!")
        self.other = users.objects.create_user(username="photo_other", password="password123!")
        self.catch = Catch.objects.create(owner=self.owner, species="Walleye")
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def url(self):
        return f"/api/catches/{self.catch.pk}/photo/"

    def upload(self, photo=None):
        return self.client.post(self.url(), {"photo": photo or example_photo()}, format="multipart")

    def file_on_disk(self):
        self.catch.refresh_from_db()
        return Path(settings.MEDIA_ROOT) / self.catch.photo.name

    def test_owner_can_upload_jpeg_reencoded_without_metadata(self):
        response = self.upload(example_photo("JPEG", width=2500, height=1300, exif=True))
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["photo_url"], self.url())
        path = self.file_on_disk()
        self.assertTrue(path.exists())
        self.assertEqual(path.suffix, ".jpg")
        with Image.open(path) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertLessEqual(max(image.size), 2048)
            self.assertFalse(image.getexif())
        response = self.client.get(self.url())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["Cross-Origin-Resource-Policy"], "same-origin")
        self.assertTrue(b"".join(response.streaming_content).startswith(b"\xff\xd8"))

    def test_private_photo_hidden_from_other_user_and_anonymous(self):
        self.upload()
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(self.url()).status_code, 404)
        self.assertEqual(self.upload().status_code, 404)
        self.assertEqual(self.client.delete(self.url()).status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url()).status_code, 404)
        self.assertIn(self.upload().status_code, (401, 403))
        self.assertIn(self.client.delete(self.url()).status_code, (401, 403))

    def test_public_photo_available_then_unpublished_immediately_blocked(self):
        self.upload()
        self.catch.is_public = True
        self.catch.latitude = "42.250000"
        self.catch.longitude = "-83.700000"
        self.catch.save()
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url()).status_code, 200)
        public = self.client.get("/api/catches/public/")
        self.assertEqual(public.data[0]["photo_url"], self.url())
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(f"/api/catches/{self.catch.pk}/", {"is_public": False}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url()).status_code, 404)
        self.assertEqual(self.client.get("/api/catches/public/").data, [])

    def test_private_photo_url_only_in_owner_payload(self):
        self.upload()
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/catches/public/").data, [])
        self.client.force_authenticate(user=self.owner)
        data = self.client.get("/api/catches/").data
        self.assertEqual(data[0]["photo_url"], self.url())
        self.assertNotIn("photo", data[0])
        self.assertNotIn("owner", data[0])

    def test_missing_photo_does_not_have_link(self):
        self.assertIsNone(self.client.get("/api/catches/").data[0]["photo_url"])
        self.assertEqual(self.client.get(self.url()).status_code, 404)

    def test_invalid_and_oversized_files_do_not_save(self):
        bad = SimpleUploadedFile("bad.jpg", b"<script>alert(1)</script>", content_type="image/jpeg")
        self.assertEqual(self.upload(bad).status_code, 400)
        gif = example_photo("GIF")
        self.assertEqual(self.upload(gif).status_code, 400)
        huge = SimpleUploadedFile("big.jpg", b"x" * (8 * 1024 * 1024 + 1), content_type="image/jpeg")
        self.assertEqual(self.upload(huge).status_code, 400)
        self.catch.refresh_from_db()
        self.assertFalse(self.catch.photo)
        self.assertFalse(list(Path(settings.MEDIA_ROOT).rglob("*.jpg")))

    def test_replacing_photo_cleans_previous_storage_file(self):
        self.assertEqual(self.upload().status_code, 200)
        original = self.file_on_disk()
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.upload(example_photo("WEBP")).status_code, 200)
        replacement = self.file_on_disk()
        self.assertNotEqual(original, replacement)
        self.assertFalse(original.exists())
        self.assertTrue(replacement.exists())

    def test_removing_photo_keeps_catch_but_deletes_image(self):
        self.upload()
        photo_path = self.file_on_disk()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url())
        self.assertEqual(response.status_code, 204)
        self.assertTrue(Catch.objects.filter(pk=self.catch.pk).exists())
        self.assertFalse(photo_path.exists())
        self.catch.refresh_from_db()
        self.assertFalse(self.catch.photo)

    def test_deleting_catch_cleans_image(self):
        self.upload()
        photo_path = self.file_on_disk()
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f"/api/catches/{self.catch.pk}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(photo_path.exists())

    def test_upload_requires_csrf_for_cookie_session(self):
        browser = Client(enforce_csrf_checks=True)
        self.assertTrue(browser.login(username="photo_owner", password="password123!"))
        response = browser.post(self.url(), {"photo": example_photo()})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Catch.objects.get(pk=self.catch.pk).photo)
