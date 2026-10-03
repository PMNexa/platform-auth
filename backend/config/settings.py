"""Django settings for platform-auth.

Standalone login service: own User model, own JWT issuance, own Postgres
database. No dependency on platform-core's models/DB - modules in this
architecture share nothing at the source/DB level, only HTTP contracts.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-secret-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "platform_auth",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
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
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


def _database_config_from_url(url: str) -> dict:
    # Accept the same DATABASE_URL shape as platform-core's .env
    # (postgresql+asyncpg://...) - Django/psycopg needs the plain scheme.
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    import urllib.parse as up

    parsed = up.urlparse(url)
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": parsed.username,
        "PASSWORD": parsed.password,
        "HOST": parsed.hostname,
        "PORT": parsed.port or 5432,
    }


_database_url = os.environ.get("DATABASE_URL")
if _database_url:
    DATABASES = {"default": _database_config_from_url(_database_url)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Auth / JWT config (same env var names as platform-core's .env.example) ---
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-only-insecure-jwt-secret")
JWT_ACCESS_TTL_MINUTES = float(os.environ.get("JWT_ACCESS_TTL_MINUTES", "15"))
JWT_REFRESH_TTL_DAYS = int(os.environ.get("JWT_REFRESH_TTL_DAYS", "30"))
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_SECURE = os.environ.get("DJANGO_DEBUG", "true").lower() != "true"
# When mounted under a gateway path prefix (e.g. "/platform-auth" - see
# modules.yaml's url_prefix / nginx/default.conf in the parent platform),
# the browser's actual requests carry that prefix, so the refresh cookie's
# Path must too or the browser will never send it back. Empty by default
# (this module standalone, served at "/").
URL_PREFIX = os.environ.get("URL_PREFIX", "")

# --- Single sign-on (platform_auth/sso.py): OpenID Connect providers.
# All three set = "Sign in with ..." on the login page. The redirect URI
# to register at the provider: <this app's address>/api/v1/auth/sso/callback.
OIDC_ISSUER = os.environ.get("OIDC_ISSUER", "")
OIDC_CLIENT_ID = os.environ.get("OIDC_CLIENT_ID", "")
OIDC_CLIENT_SECRET = os.environ.get("OIDC_CLIENT_SECRET", "")
OIDC_SCOPES = os.environ.get("OIDC_SCOPES") or "openid email profile"
# Treat the provider's email as verified when it sends no `email_verified`
# claim (Microsoft Entra ID). Only for a provider you run or trust.
OIDC_TRUST_EMAIL = (os.environ.get("OIDC_TRUST_EMAIL") or "").lower() in ("1", "true", "yes")
# Only when the address Django sees isn't the public one.
OIDC_REDIRECT_URI = os.environ.get("OIDC_REDIRECT_URI", "")
# More providers, each with its own button: a JSON list of {"id", "label",
# "issuer", "client_id", "client_secret"} (optional "scopes",
# "trust_email"). Same redirect URI as above.
OIDC_PROVIDERS = json.loads(os.environ.get("OIDC_PROVIDERS") or "[]")

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["platform_auth.authentication.ActorAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": [],
    "EXCEPTION_HANDLER": "core_api.exceptions.platform_exception_handler",
    "UNAUTHENTICATED_USER": None,
}
