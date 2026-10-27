"""Real CSRF and cookie/session tests for the Fishtories browser API."""
import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase


class SessionAuthenticationTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = get_user_model().objects.create_user(
            username="troutfan", email="trout@example.com", password="BluegillTrail!293"
        )
        self.origin = {"HTTP_HOST": "localhost:5173", "HTTP_ORIGIN": "http://localhost:5173"}

    def csrf(self):
        response = self.client.get("/api/auth/csrf/", HTTP_HOST="localhost:5173")
        self.assertEqual(response.status_code, 200)
        return response.json()["csrfToken"]

    def post(self, path, payload=None, with_csrf=True):
        headers = self.origin.copy()
        if with_csrf:
            headers["HTTP_X_CSRFTOKEN"] = self.csrf()
        return self.client.post(
            path,
            data=json.dumps(payload or {}),
            content_type="application/json",
            **headers,
        )

    def test_anonymous_me_returns_401(self):
        response = self.client.get("/api/auth/me/", HTTP_HOST="localhost:5173")
        self.assertEqual(response.status_code, 401)

    def test_login_then_me_then_logout(self):
        signed_in = self.post("/api/auth/login/", {"username": "troutfan", "password": "BluegillTrail!293"})
        self.assertEqual(signed_in.status_code, 200)
        self.assertEqual(signed_in.json()["username"], "troutfan")
        self.assertNotIn("password", signed_in.json())
        self.assertIn("sessionid", self.client.cookies)

        me = self.client.get("/api/auth/me/", HTTP_HOST="localhost:5173")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], "trout@example.com")
        self.assertIn("no-store", me["Cache-Control"])

        logout = self.post("/api/auth/logout/")
        self.assertEqual(logout.status_code, 200)
        me = self.client.get("/api/auth/me/", HTTP_HOST="localhost:5173")
        self.assertEqual(me.status_code, 401)

    def test_login_requires_csrf(self):
        response = self.post("/api/auth/login/", {"username": "troutfan", "password": "BluegillTrail!293"}, with_csrf=False)
        self.assertEqual(response.status_code, 403)

    def test_logout_requires_csrf(self):
        self.post("/api/auth/login/", {"username": "troutfan", "password": "BluegillTrail!293"})
        response = self.post("/api/auth/logout/", with_csrf=False)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.get("/api/auth/me/", HTTP_HOST="localhost:5173").status_code, 200)

    def test_wrong_password_rejected_without_logging_in(self):
        response = self.post("/api/auth/login/", {"username": "troutfan", "password": "wrong"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get("/api/auth/me/", HTTP_HOST="localhost:5173").status_code, 401)

    def test_logout_is_not_a_get_request(self):
        self.post("/api/auth/login/", {"username": "troutfan", "password": "BluegillTrail!293"})
        response = self.client.get("/api/auth/logout/", HTTP_HOST="localhost:5173")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(self.client.get("/api/auth/me/", HTTP_HOST="localhost:5173").status_code, 200)
