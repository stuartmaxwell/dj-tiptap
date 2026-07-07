"""Django settings for running tests."""

from .settings import *  # noqa: F403, F401, RUF100

# A throwaway file database for the Playwright-driven runserver: an in-memory
# database can't be used there, because `migrate` and `runserver` run as
# separate processes and each process gets its own :memory: database.
#
# Django's own test runner is unaffected: for SQLite it ignores NAME and
# creates an in-memory test database by default, so `manage.py test
# --settings=config.settings_testing` still runs fully in memory.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test_playwright.sqlite3",  # noqa: F405
    },
}

PASSWORD_HASHERS: list[str] = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Keep Playwright-driven uploads out of the real media/ directory. `flush`
# clears database rows between runs but never deletes files.
MEDIA_ROOT = BASE_DIR / "test_media"  # noqa: F405
