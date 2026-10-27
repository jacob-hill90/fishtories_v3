"""Milestone 7: tests for opt-in public sharing, private data, and permissions."""
import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from rest_framework.test import APIClient

from .models import Catch


class CatchVisibilityTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.angler = user_model.objects.create_user(username="sharing_angler", password="example-pass-1")
        self.other = user_model.objects.create_user(username="sharing_other", password="example-pass-2")
        self.client = APIClient()
        self.client.force_authenticate(user=self.angler)

    def create(self, **kwargs):
        return Catch.objects.create(
            owner=self.angler, species="Walleye", latitude="42.200000", longitude="-83.700000", **kwargs,
        )

    def public(self):
        return self.client.get("/api/catches/public/")

    def test_default_is_private_for_created_and_existing_style_catches(self):
        created = self.client.post("/api/catches/", {"species": "Pike"}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertFalse(created.data["is_public"])
        self.assertFalse(Catch.objects.get(pk=created.data["id"]).is_public)
        self.assertEqual(self.public().data, [])

    def test_public_endpoint_only_returns_published_geolocated_catches(self):
        self.create(notes="My secret place", is_public=False)
        published = self.create(is_public=True, notes="Public story", location_name="Huron River")
        Catch.objects.create(owner=self.other, species="Trout", is_public=False,
                             latitude="44.000000", longitude="-86.000000")
        response = self.public()
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [published.id])
        self.assertEqual(response.data[0]["notes"], "Public story")
        self.assertEqual(response.data[0]["latitude"], "42.200000")
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_anonymous_can_read_only_public_feed(self):
        published = self.create(is_public=True)
        self.client.force_authenticate(user=None)
        self.assertEqual([item["id"] for item in self.public().data], [published.pk])
        self.assertIn(self.client.get("/api/catches/").status_code, (401, 403))
        self.assertIn(self.client.get(f"/api/catches/{published.pk}/").status_code, (401, 403))

    def test_public_fields_are_explicit_and_never_contain_owner_identity(self):
        self.create(is_public=True)
        payload = self.public().data[0]
        self.assertEqual(set(payload), {
            "id", "species", "caught_at", "location_name", "weight_lb",
            "length_in", "latitude", "longitude", "notes", "photo_url",
        })
        self.assertNotIn("owner", payload)
        self.assertNotIn("email", payload)
        self.assertNotIn("username", payload)
        self.assertNotIn("is_public", payload)

    def test_can_publish_and_unpublish_without_changing_ownership(self):
        catch = self.create(is_public=False)
        published = self.client.patch(f"/api/catches/{catch.pk}/", {"is_public": True}, format="json")
        self.assertEqual(published.status_code, 200, published.data)
        self.assertEqual([row["id"] for row in self.public().data], [catch.pk])
        unpublished = self.client.patch(f"/api/catches/{catch.pk}/", {"is_public": False}, format="json")
        self.assertEqual(unpublished.status_code, 200, unpublished.data)
        self.assertEqual(self.public().data, [])
        catch.refresh_from_db()
        self.assertEqual(catch.owner, self.angler)

    def test_publishing_requires_both_coordinates(self):
        for payload in (
            {"species": "Pike", "is_public": True},
            {"species": "Pike", "is_public": True, "latitude": 42},
            {"species": "Pike", "is_public": True, "longitude": -83},
        ):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post("/api/catches/", payload, format="json").status_code, 400)
        self.assertFalse(Catch.objects.filter(owner=self.angler).exists())

    def test_public_catch_cannot_clear_pin_without_unpublishing(self):
        catch = self.create(is_public=True)
        response = self.client.patch(f"/api/catches/{catch.pk}/",
                                     {"latitude": None, "longitude": None}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.patch(f"/api/catches/{catch.pk}/",
                                     {"latitude": None, "longitude": None, "is_public": False}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.public().data, [])

    def test_cannot_edit_or_delete_another_users_public_catch(self):
        stranger = Catch.objects.create(owner=self.other, species="Bass", is_public=True,
                                        latitude="44.000000", longitude="-84.000000")
        self.assertEqual(self.client.get(f"/api/catches/{stranger.pk}/").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/catches/{stranger.pk}/",
                                           {"is_public": False}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/catches/{stranger.pk}/").status_code, 404)
        stranger.refresh_from_db()
        self.assertTrue(stranger.is_public)

    def test_public_feed_is_read_only(self):
        for method in ("post", "patch", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)("/api/catches/public/", {"is_public": False}, format="json")
                self.assertEqual(response.status_code, 405)

    def test_public_story_preview_is_bounded(self):
        self.create(is_public=True, notes="a" * 5000)
        self.assertEqual(len(self.public().data[0]["notes"]), 1000)

    def test_public_feed_caps_results(self):
        for _ in range(251):
            self.create(is_public=True)
        self.assertEqual(len(self.public().data), 250)


class PublicCatchCsrfTests(TestCase):
    def test_authenticated_publish_requires_csrf(self):
        get_user_model().objects.create_user(username="csrfpub", password="example-pass-1")
        browser = Client(enforce_csrf_checks=True)
        self.assertTrue(browser.login(username="csrfpub", password="example-pass-1"))
        response = browser.post(
            "/api/catches/",
            data=json.dumps({"species": "Trout", "is_public": True,
                             "latitude": 42.2, "longitude": -83.7}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Catch.objects.exists())
