from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.catches.models import Catch
from django.contrib.auth import get_user_model

from .models import FishSpecies


class FishDatabaseTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        FishSpecies.objects.create(common_name="Smallmouth bass", scientific_name="Micropterus dolomieu")
        FishSpecies.objects.create(common_name="Walleye", scientific_name="Sander vitreus")

    def test_public_species_list_is_read_only(self):
        response = self.client.get("/api/fish/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["common_name"] for item in response.data], ["Smallmouth bass", "Walleye"])
        self.assertEqual(self.client.post("/api/fish/", {"common_name": "Fake"}).status_code, 405)
        self.assertFalse(FishSpecies.objects.filter(common_name="Fake").exists())

    def test_search_by_common_or_scientific_name(self):
        common = self.client.get("/api/fish/", {"q": "small"})
        self.assertEqual([item["common_name"] for item in common.data], ["Smallmouth bass"])
        scientific = self.client.get("/api/fish/", {"q": "vitreus"})
        self.assertEqual([item["common_name"] for item in scientific.data], ["Walleye"])

    def test_seed_command_is_repeatable_and_preserves_existing_species(self):
        FishSpecies.objects.filter(common_name="Walleye").update(scientific_name="customized")
        stdout = StringIO()
        call_command("seed_fish_species", stdout=stdout)
        first_count = FishSpecies.objects.count()
        self.assertGreaterEqual(first_count, 20)
        call_command("seed_fish_species", stdout=stdout)
        self.assertEqual(FishSpecies.objects.count(), first_count)
        self.assertEqual(FishSpecies.objects.get(common_name="Walleye").scientific_name, "customized")

    def test_fish_catalog_does_not_change_existing_catches(self):
        owner = get_user_model().objects.create_user(username="angler5", password="test-password-123")
        catch = Catch.objects.create(owner=owner, species="My own local fish")
        self.client.force_authenticate(user=owner)
        response = self.client.get("/api/catches/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["species"], "My own local fish")
        catch.refresh_from_db()
        self.assertEqual(catch.species, "My own local fish")
