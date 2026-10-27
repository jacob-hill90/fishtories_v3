import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

User = get_user_model()


class RegistrationTests(TestCase):
    def setUp(self):
        # actually enforce CSRF rules
        self.client = Client(enforce_csrf_checks=True)
        self.payload = {
            "username": "anglermia",
            "email": "mia@example.com",
            "password": "BluegillTrail!293",
            "password_confirm": "BluegillTrail!293",
        }

    def post_registration(self, data, with_csrf=True):
        kwargs = {"HTTP_HOST": "localhost:5173", "HTTP_ORIGIN": "http://localhost:5173"}
        if with_csrf:
            response = self.client.get("/api/auth/csrf/", HTTP_HOST="localhost:5173")
            self.assertEqual(response.status_code, 200)
            self.assertIn("csrftoken", response.cookies)
            kwargs["HTTP_X_CSRFTOKEN"] = response.json()["csrfToken"]
        return self.client.post(
            "/api/auth/register/",
            data=json.dumps(data),
            content_type="application/json",
            **kwargs,
        )

    def test_creates_user_with_hashed_password(self):
        response = self.post_registration(self.payload)
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="anglermia")
        self.assertEqual(user.email, "mia@example.com")
        self.assertTrue(user.check_password(self.payload["password"]))
        self.assertNotEqual(user.password, self.payload["password"])
        self.assertNotIn("password", response.json())
        self.assertNotIn("password_confirm", response.json())

    def test_registration_requires_csrf(self):
        response = self.post_registration(self.payload, with_csrf=False)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(User.objects.count(), 0)

    def test_duplicate_username_is_rejected(self):
        self.post_registration(self.payload)
        response = self.post_registration(self.payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.json())
        self.assertEqual(User.objects.count(), 1)

    def test_weak_password_is_rejected(self):
        response = self.post_registration({**self.payload, "password": "123", "password_confirm": "123"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.json())

    def test_mismatched_passwords_are_rejected(self):
        response = self.post_registration({**self.payload, "password_confirm": "SomethingElse123!"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("password_confirm", response.json())

    def test_bad_email_is_rejected(self):
        response = self.post_registration({**self.payload, "email": "not-an-email"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.json())
