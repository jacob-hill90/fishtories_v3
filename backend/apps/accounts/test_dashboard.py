"""Dashboard permissions and ownership regression tests."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.catches.models import Catch


class DashboardTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.alice = User.objects.create_user(
            username="alice", email="alice@example.com", password="TestStrong!1290"
        )
        self.bob = User.objects.create_user(
            username="bob", email="bob@example.com", password="TestStrong!1290"
        )
        now = timezone.now()
        Catch.objects.create(owner=self.alice, species="Bass", caught_at=now, location_name="Lake Erie")
        Catch.objects.create(owner=self.alice, species="bass", caught_at=now - timedelta(days=1), location_name="lake erie")
        Catch.objects.create(owner=self.alice, species="Pike", caught_at=now - timedelta(days=2), location_name="")
        Catch.objects.create(owner=self.bob, species="Trout", caught_at=now, location_name="Secret spot")

    def test_anonymous_cannot_read_dashboard(self):
        response = self.client.get("/api/auth/dashboard/")
        self.assertEqual(response.status_code, 401)

    def test_dashboard_only_contains_authenticated_users_data(self):
        self.client.force_login(self.alice)
        response = self.client.get("/api/auth/dashboard/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response["Cache-Control"])
        data = response.json()
        self.assertEqual(data["user"]["username"], "alice")
        self.assertEqual(data["user"]["email"], "alice@example.com")
        self.assertIn("date_joined", data["user"])
        self.assertEqual(data["stats"], {"total_catches": 3, "species_count": 2, "locations_count": 1})
        self.assertEqual(len(data["recent_catches"]), 3)
        self.assertNotIn("Trout", [item["species"] for item in data["recent_catches"]])
        self.assertNotIn("password", str(data))

    def test_dashboard_ignores_query_parameter_user_id(self):
        self.client.force_login(self.bob)
        response = self.client.get(f"/api/auth/dashboard/?user_id={self.alice.pk}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stats"]["total_catches"], 1)
        self.assertEqual(response.json()["recent_catches"][0]["species"], "Trout")
