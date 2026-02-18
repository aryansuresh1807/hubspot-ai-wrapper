"""
Patch google.auth._helpers.utcnow to always return timezone-aware datetime.
Import this FIRST before any google.auth modules anywhere in the app.
"""

from datetime import datetime, timezone


def patch_google_auth():
    """Monkey-patch google.auth._helpers.utcnow to return timezone-aware UTC."""
    try:
        from google.auth import _helpers

        original_utcnow = _helpers.utcnow

        def patched_utcnow():
            result = original_utcnow()
            if result.tzinfo is None:
                return result.replace(tzinfo=timezone.utc)
            return result

        _helpers.utcnow = patched_utcnow
    except Exception:
        pass  # If patch fails, continue anyway


# Apply patch immediately when this module is imported
patch_google_auth()
