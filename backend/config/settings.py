"""Fishtories settings: SQLite/local photos in dev, Postgres/private R2 in production."""
import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
load_dotenv(BASE_DIR / ".env")

DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in {"1", "true", "yes", "on"}
if os.getenv("RENDER") and DEBUG and os.getenv("BUILDING_STATIC_ASSETS") != "1":
    raise RuntimeError("DJANGO_DEBUG must be False on Render.")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if DEBUG and not SECRET_KEY:
    SECRET_KEY = "development-only-not-for-production"
if not DEBUG and (len(SECRET_KEY) < 50 or SECRET_KEY.startswith("development-")):
    raise RuntimeError("Set a strong DJANGO_SECRET_KEY in production (50+ characters).")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1" if DEBUG else "").split(",")
    if host.strip()
]
render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME")
if render_host and render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_host)
if not DEBUG and not ALLOWED_HOSTS:
    raise RuntimeError("Set DJANGO_ALLOWED_HOSTS to the production domain(s).")

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "storages",  # harmless in development; used for private R2 in production
    "apps.accounts",
    "apps.catches",
    "apps.fish",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # only serves *built* frontend and static assets
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [FRONTEND_DIST],  # SPA's built index.html served for known React routes
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DEBUG and not DATABASE_URL:
    raise RuntimeError("Set DATABASE_URL to your Neon PostgreSQL connection string.")
if not DEBUG and not DATABASE_URL.startswith(("postgresql://", "postgres://")):
    raise RuntimeError("Production DATABASE_URL must be PostgreSQL (Neon).")
if DATABASE_URL:
    # Neon uses TLS. No long-lived idle database connections on the free tier.
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL, conn_max_age=0, ssl_require=not DEBUG
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ROOT_DIR / "database" / "dev.sqlite3",
            "OPTIONS": {"timeout": 20},
        }
    }

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django admin files go under /static/; Vite's hashed /assets/, fish photos,
# hero image, and favicon come from the built frontend (WHITENOISE_ROOT).
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
WHITENOISE_ROOT = FRONTEND_DIST if FRONTEND_DIST.is_dir() else None
WHITENOISE_MAX_AGE = 300  # short cache for unversioned public assets

MEDIA_ROOT = BASE_DIR / "media"  # only used on the developer machine

# Never expose /media/ or raw R2 object URLs. User-uploaded photos and avatars
# always pass through Django's permission-checked endpoints.
r2_fields = {
    "R2_BUCKET_NAME": os.getenv("R2_BUCKET_NAME", ""),
    "R2_ENDPOINT_URL": os.getenv("R2_ENDPOINT_URL", ""),
    "R2_ACCESS_KEY_ID": os.getenv("R2_ACCESS_KEY_ID", ""),
    "R2_SECRET_ACCESS_KEY": os.getenv("R2_SECRET_ACCESS_KEY", ""),
}
if not DEBUG:
    missing = [key for key, value in r2_fields.items() if not value]
    if missing:
        raise RuntimeError("Private R2 storage is required in production: " + ", ".join(missing))

STORAGES = {
    "default": (
        {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        }
        if DEBUG else
        {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": r2_fields["R2_BUCKET_NAME"],
                "endpoint_url": r2_fields["R2_ENDPOINT_URL"],
                "access_key": r2_fields["R2_ACCESS_KEY_ID"],
                "secret_key": r2_fields["R2_SECRET_ACCESS_KEY"],
                "region_name": "auto",
                "signature_version": "s3v4",
                "location": "private",  # all user uploads stay within this bucket prefix
                # Omit ACL headers; R2 access is governed by bucket policies.
                "file_overwrite": False,
                "querystring_auth": True,
                "object_parameters": {"CacheControl": "private,no-store,max-age=0"},
            },
        }
    ),
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Render terminates TLS upstream and sets X-Forwarded-Proto. Only enable this
# behind Render (or another proxy that strips untrusted incoming forwarded headers).
if os.getenv("RENDER"):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_HSTS_SECONDS = 300 if not DEBUG else 0
