"""Private catch map: coordinates, validation and isolation by account."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Catch


class CatchMapTests(TestCase):
    def setUp(self):
        user_type = get_user_model()
        self.angler = user_type.objects.create_user(username="map_angler", password="test-pass-123")
        self.stranger = user_type.objects.create_user(username="map_stranger", password="test-pass-456")
        self.stranger_catch = Catch.objects.create(
            owner=self.stranger, species="Walleye", latitude="44.500000", longitude="-85.200000"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.angler)

    def test_saves_coordinates_and_lists_only_owners_data(self):
        response = self.client.post("/api/catches/", {
            "species": "Smallmouth bass", "location_name": "My private spot",
            "latitude": 42.280826, "longitude": -83.743038,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        stored = Catch.objects.get(pk=response.data["id"])
        self.assertEqual(str(stored.latitude), "42.280826")
        self.assertEqual(str(stored.longitude), "-83.743038")
        self.assertEqual(stored.owner, self.angler)
        result = self.client.get("/api/catches/")
        self.assertEqual(result.status_code, 200)
        self.assertEqual([entry["id"] for entry in result.data], [stored.pk])
        self.assertEqual(result.data[0]["latitude"], "42.280826")

    def test_other_users_exact_location_is_hidden(self):
        self.assertEqual(self.client.get(f"/api/catches/{self.stranger_catch.pk}/").status_code, 404)
        self.assertEqual(self.client.patch(
            f"/api/catches/{self.stranger_catch.pk}/", {"latitude": "40.1"}, format="json"
        ).status_code, 404)
        self.assertEqual(self.client.get("/api/catches/").data, [])

    def test_anonymous_get_is_rejected(self):
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get("/api/catches/").status_code, (401, 403))

    def test_old_catch_without_coordinates_remains_valid(self):
        catch = Catch.objects.create(owner=self.angler, species="Panfish")
        response = self.client.get(f"/api/catches/{catch.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["latitude"])
        self.assertIsNone(response.data["longitude"])

    def test_missing_coordinate_pair_is_rejected(self):
        for payload in (
            {"species": "Pike", "latitude": 43},
            {"species": "Pike", "longitude": -82},
        ):
            with self.subTest(payload=payload):
                result = self.client.post("/api/catches/", payload, format="json")
                self.assertEqual(result.status_code, 400, result.data)
        self.assertFalse(Catch.objects.filter(owner=self.angler).exists())

    def test_invalid_latitude_or_longitude_is_rejected(self):
        for lat, lng in ((91, -83), (-91, -83), (42, 181), (42, -181)):
            with self.subTest(latitude=lat, longitude=lng):
                result = self.client.post("/api/catches/", {
                    "species": "Trout", "latitude": lat, "longitude": lng,
                }, format="json")
                self.assertEqual(result.status_code, 400, result.data)
        self.assertFalse(Catch.objects.filter(owner=self.angler).exists())

    def test_edit_coordinate_pair_and_clear_it(self):
        catch = Catch.objects.create(owner=self.angler, species="Perch")
        update = self.client.patch(f"/api/catches/{catch.pk}/", {
            "latitude": "44.123456", "longitude": "-85.012345",
        }, format="json")
        self.assertEqual(update.status_code, 200, update.data)
        catch.refresh_from_db()
        self.assertEqual(str(catch.latitude), "44.123456")
        invalid = self.client.patch(f"/api/catches/{catch.pk}/", {"longitude": None}, format="json")
        self.assertEqual(invalid.status_code, 400, invalid.data)
        cleared = self.client.patch(f"/api/catches/{catch.pk}/", {
            "latitude": None, "longitude": None,
        }, format="json")
        self.assertEqual(cleared.status_code, 200, cleared.data)
        catch.refresh_from_db()
        self.assertIsNone(catch.latitude)
        self.assertIsNone(catch.longitude)
