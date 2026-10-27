from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Catch


class CatchPermissionsTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.alice = user_model.objects.create_user(username="alice", password="test-pass-1234")
        self.bob = user_model.objects.create_user(username="bob", password="test-pass-5678")
        self.alice_catch = Catch.objects.create(owner=self.alice, species="Bluegill")
        self.bob_catch = Catch.objects.create(owner=self.bob, species="Bass")
        self.client = APIClient()

    def test_anonymous_cannot_read_catches(self):
        self.assertIn(self.client.get("/api/catches/").status_code, (401, 403))

    def test_only_own_catches_are_listed(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.get("/api/catches/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["species"], "Bluegill")

    def test_cannot_delete_another_users_catch(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.delete(f"/api/catches/{self.bob_catch.pk}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Catch.objects.filter(pk=self.bob_catch.pk).exists())

    def test_cannot_edit_another_users_catch(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.patch(
            f"/api/catches/{self.bob_catch.pk}/",
            {"species": "Changed"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)
        self.bob_catch.refresh_from_db()
        self.assertEqual(self.bob_catch.species, "Bass")

    def test_new_catch_is_owned_by_authenticated_user(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.post(
            "/api/catches/",
            {"species": "Perch", "owner": self.bob.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Catch.objects.get(pk=response.data["id"]).owner, self.alice)
