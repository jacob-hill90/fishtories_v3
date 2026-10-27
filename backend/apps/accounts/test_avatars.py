"""Milestone 11: secure self-service profile picture uploads."""
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from PIL import Image


def avatar_file(fmt="PNG", width=200, height=120, exif=False):
    image = Image.new("RGB", (width, height), "#2f7a73")
    buffer = BytesIO()
    options = {}
    if exif:
        metadata = Image.Exif()
        metadata[270] = "PRIVATE GPS / camera notes"
        options["exif"] = metadata
    image.save(buffer, fmt, **options)
    return SimpleUploadedFile("avatar." + fmt.lower(), buffer.getvalue(), content_type="image/" + fmt.lower())


class AvatarTests(TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        override = override_settings(MEDIA_ROOT=directory.name)
        override.enable()
        self.addCleanup(override.disable)
        User = get_user_model()
        self.alice = User.objects.create_user(username="angler_one", password="VerySecure!123")
        self.bob = User.objects.create_user(username="angler_two", password="VerySecure!123")
        self.url = "/api/auth/avatar/"

    def upload(self, file=None):
        return self.client.post(self.url, {"avatar": file or avatar_file()})

    def test_anonymous_cannot_view_upload_or_delete(self):
        self.assertIn(self.client.get(self.url).status_code, (401, 403))
        self.assertIn(self.upload().status_code, (401, 403))
        self.assertIn(self.client.delete(self.url).status_code, (401, 403))

    def test_upload_and_get_reencoded_without_exif(self):
        self.client.force_login(self.alice)
        result = self.upload(avatar_file("JPEG", 1200, 800, exif=True))
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["user"]["avatar_url"], self.url)
        self.assertEqual(self.client.get("/api/auth/me/").json()["avatar_url"], self.url)
        self.assertEqual(self.client.get("/api/auth/dashboard/").json()["user"]["avatar_url"], self.url)
        self.alice.refresh_from_db()
        saved_file = Path(settings.MEDIA_ROOT) / self.alice.avatar.name
        self.assertTrue(saved_file.exists())
        with Image.open(saved_file) as img:
            self.assertEqual(img.format, "JPEG")
            self.assertLessEqual(max(img.size), 512)
            self.assertFalse(img.getexif())
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertTrue(b"".join(response.streaming_content).startswith(b"\xff\xd8"))

    def test_other_account_only_sees_own_avatar(self):
        self.client.force_login(self.alice)
        self.assertEqual(self.upload().status_code, 200)
        self.client.force_login(self.bob)
        self.assertIsNone(self.client.get("/api/auth/me/").json()["avatar_url"])
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertFalse(self.bob.avatar)
        # No user ID parameter accepted.
        self.assertEqual(self.client.get(f"{self.url}?user_id={self.alice.pk}").status_code, 404)

    def test_invalid_upload_does_not_save_and_replacement_deletes_previous(self):
        self.client.force_login(self.alice)
        invalid = SimpleUploadedFile("x.jpg", b"<script />", content_type="image/jpeg")
        self.assertEqual(self.upload(invalid).status_code, 400)
        oversized = SimpleUploadedFile("huge.jpg", b"0" * (8 * 1024 * 1024 + 1), content_type="image/jpeg")
        self.assertEqual(self.upload(oversized).status_code, 400)
        self.assertEqual(self.upload(avatar_file("GIF")).status_code, 400)
        self.alice.refresh_from_db()
        self.assertFalse(self.alice.avatar)
        self.assertEqual(self.upload().status_code, 200)
        self.alice.refresh_from_db()
        old = Path(settings.MEDIA_ROOT) / self.alice.avatar.name
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.upload(avatar_file("WEBP")).status_code, 200)
        self.alice.refresh_from_db()
        new = Path(settings.MEDIA_ROOT) / self.alice.avatar.name
        self.assertTrue(new.exists())
        self.assertFalse(old.exists())

    def test_delete_removes_image_but_not_account(self):
        self.client.force_login(self.alice)
        self.upload()
        self.alice.refresh_from_db()
        original = Path(settings.MEDIA_ROOT) / self.alice.avatar.name
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["user"]["avatar_url"])
        self.alice.refresh_from_db()
        self.assertFalse(self.alice.avatar)
        self.assertFalse(original.exists())
        self.assertTrue(get_user_model().objects.filter(pk=self.alice.pk).exists())

    def test_deleting_user_cleans_file(self):
        self.client.force_login(self.alice)
        self.upload()
        self.alice.refresh_from_db()
        original = Path(settings.MEDIA_ROOT) / self.alice.avatar.name
        with self.captureOnCommitCallbacks(execute=True):
            self.alice.delete()
        self.assertFalse(original.exists())

    def test_cookie_session_requires_csrf_for_upload_and_remove(self):
        browser = Client(enforce_csrf_checks=True)
        self.assertTrue(browser.login(username="angler_one", password="VerySecure!123"))
        self.assertEqual(browser.post(self.url, {"avatar": avatar_file()}).status_code, 403)
        self.assertEqual(browser.delete(self.url).status_code, 403)
