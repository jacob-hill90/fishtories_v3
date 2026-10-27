"""End-to-end API tests exercising real session cookies and CSRF protection."""
import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from .models import Catch


class CatchJournalTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.angler = user_model.objects.create_user(username="angler", password="Fishing!12345")
        self.other = user_model.objects.create_user(username="other", password="Fishing!67890")
        self.other_catch = Catch.objects.create(owner=self.other, species="Walleye")
        self.client = Client(enforce_csrf_checks=True)
        self.browser_host = {"HTTP_HOST": "localhost:5173", "HTTP_ORIGIN": "http://localhost:5173"}

    def token(self):
        return self.client.get("/api/auth/csrf/", HTTP_HOST="localhost:5173").json()["csrfToken"]

    def login(self):
        token = self.token()
        response = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"username": "angler", "password": "Fishing!12345"}),
            content_type="application/json", HTTP_X_CSRFTOKEN=token, **self.browser_host,
        )
        self.assertEqual(response.status_code, 200)

    def write(self, method, path, payload=None, csrf=True):
        headers = self.browser_host.copy()
        if csrf:
            headers["HTTP_X_CSRFTOKEN"] = self.token()
        return getattr(self.client, method)(
            path,
            data=json.dumps(payload or {}),
            content_type="application/json",
            **headers,
        )

    def test_unauthenticated_cannot_create_or_read(self):
        self.assertIn(self.client.get("/api/catches/", HTTP_HOST="localhost:5173").status_code, (401, 403))
        response = self.write("post", "/api/catches/", {"species": "Perch"})
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(Catch.objects.filter(species="Perch").count(), 0)

    def test_create_list_edit_delete_and_dashboard(self):
        self.login()
        created = self.write("post", "/api/catches/", {
            "species": "Smallmouth bass", "weight_lb": "2.75", "length_in": "16.50",
            "location_name": "Huron River", "notes": "Caught on a spinner.",
            "caught_at": "2026-09-12T13:30:00Z", "owner": self.other.pk,
        })
        self.assertEqual(created.status_code, 201, created.content)
        catch_id = created.json()["id"]
        catch = Catch.objects.get(pk=catch_id)
        self.assertEqual(catch.owner, self.angler)
        self.assertEqual(str(catch.weight_lb), "2.75")

        listed = self.client.get("/api/catches/", HTTP_HOST="localhost:5173")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual([item["id"] for item in listed.json()], [catch_id])

        dashboard = self.client.get("/api/auth/dashboard/", HTTP_HOST="localhost:5173").json()
        self.assertEqual(dashboard["stats"]["total_catches"], 1)
        self.assertEqual(dashboard["stats"]["species_count"], 1)
        self.assertEqual(dashboard["stats"]["locations_count"], 1)

        edited = self.write("patch", f"/api/catches/{catch_id}/", {
            "species": "Largemouth bass", "weight_lb": None,
        })
        self.assertEqual(edited.status_code, 200, edited.content)
        catch.refresh_from_db()
        self.assertEqual(catch.species, "Largemouth bass")
        self.assertIsNone(catch.weight_lb)

        deleted = self.write("delete", f"/api/catches/{catch_id}/")
        self.assertEqual(deleted.status_code, 204, deleted.content)
        self.assertFalse(Catch.objects.filter(pk=catch_id).exists())
        dashboard = self.client.get("/api/auth/dashboard/", HTTP_HOST="localhost:5173").json()
        self.assertEqual(dashboard["stats"]["total_catches"], 0)

    def test_another_users_catch_is_not_accessible(self):
        self.login()
        path = f"/api/catches/{self.other_catch.pk}/"
        self.assertEqual(self.client.get(path, HTTP_HOST="localhost:5173").status_code, 404)
        self.assertEqual(self.write("patch", path, {"species": "Renamed"}).status_code, 404)
        self.assertEqual(self.write("delete", path).status_code, 404)
        self.other_catch.refresh_from_db()
        self.assertEqual(self.other_catch.species, "Walleye")

    def test_session_write_requires_csrf(self):
        self.login()
        response = self.write("post", "/api/catches/", {"species": "Pike"}, csrf=False)
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Catch.objects.filter(species="Pike").exists())

    def test_measurements_must_be_positive(self):
        self.login()
        for bad_data in ({"weight_lb": "0"}, {"weight_lb": "-1.2"}, {"length_in": "0"}, {"length_in": "-3"}):
            with self.subTest(bad_data=bad_data):
                result = self.write("post", "/api/catches/", {"species": "Trout", **bad_data})
                self.assertEqual(result.status_code, 400, result.content)
        self.assertFalse(Catch.objects.filter(owner=self.angler).exists())

    def test_species_is_required(self):
        self.login()
        response = self.write("post", "/api/catches/", {"species": "   "})
        self.assertEqual(response.status_code, 400)
