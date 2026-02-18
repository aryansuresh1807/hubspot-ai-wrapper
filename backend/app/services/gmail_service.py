"""
Gmail API: load tokens from DB, build authenticated client with auto-refresh.
Uses google-auth-oauthlib and google-api-python-client.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.core.config import get_settings
from app.services.supabase_service import SupabaseService

logger = logging.getLogger(__name__)

# Gmail read-only scope
GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


def _ensure_utc_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime is timezone-aware (UTC). Google auth compares expiry to utcnow()."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _credentials_from_tokens(
    access_token: str,
    refresh_token: Optional[str],
    token_expiry: Optional[datetime],
    client_id: str,
    client_secret: str,
) -> Credentials:
    """Build Credentials from stored tokens. Token expiry can be None (treated as expired)."""
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=[GMAIL_READONLY_SCOPE],
    )
    if token_expiry:
        creds.expiry = _ensure_utc_aware(token_expiry)
    return creds


async def get_gmail_client(user_id: str, supabase: SupabaseService):
    """
    Load Gmail tokens for the given user from the DB, build an authenticated
    Gmail API client, and refresh the access token if expired.
    Returns the Gmail API service object, or None if the user has no tokens.
    """
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        logger.warning("Google OAuth not configured (GOOGLE_CLIENT_ID/SECRET)")
        return None

    row = await supabase.get_gmail_tokens(user_id)
    if not row:
        return None

    access_token = row.get("access_token")
    refresh_token = row.get("refresh_token")
    token_expiry_str = row.get("token_expiry")
    token_expiry: Optional[datetime] = None
    if token_expiry_str:
        try:
            token_expiry = datetime.fromisoformat(token_expiry_str.replace("Z", "+00:00"))
            token_expiry = _ensure_utc_aware(token_expiry)
        except Exception:
            pass

    creds = _credentials_from_tokens(
        access_token=access_token or "",
        refresh_token=refresh_token,
        token_expiry=token_expiry,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )

    # Refresh if expired
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Persist new tokens; preserve last_connected_at and email (only set on OAuth connect)
            existing_connected_at = row.get("last_connected_at")
            last_connected_dt = None
            if existing_connected_at:
                try:
                    last_connected_dt = datetime.fromisoformat(str(existing_connected_at).replace("Z", "+00:00"))
                except Exception:
                    pass
            await supabase.upsert_gmail_tokens(
                user_id=user_id,
                access_token=creds.token or "",
                refresh_token=creds.refresh_token,
                token_expiry=creds.expiry,
                last_connected_at=last_connected_dt,
                email=row.get("email"),
            )
        except Exception as e:
            logger.error("Gmail token refresh failed for user %s: %s", user_id, e)
            return None

    service = build("gmail", "v1", credentials=creds)
    return service
