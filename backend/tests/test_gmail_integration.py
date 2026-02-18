"""
Integration test for Gmail: load credentials from DB and fetch the last 5 emails.

How to run:
-----------
1. From the backend directory, ensure .env is configured:
   - SUPABASE_URL, SUPABASE_SERVICE_KEY (to load Gmail tokens from DB)
   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (for token refresh if needed)

2. Set the user ID of an account that has already connected Gmail (Integrations page).
   Either set env var or pass as first argument:

   cd backend
   set GMAIL_TEST_USER_ID=your-supabase-user-uuid
   python -m tests.test_gmail_integration

   Or:
   python -m tests.test_gmail_integration your-supabase-user-uuid

3. You can get the user ID (UUID) from Supabase Auth users table, or from your
   app after signing in (e.g. from the JWT sub claim or /api/v1/auth/me).
"""

# MUST be first - patches google.auth before any other imports
import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND_DIR)
from app.core import google_auth_patch  # noqa: F401

import asyncio
from typing import Any, Dict, List

# Load .env from backend directory
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_BACKEND_DIR, ".env"))
except ImportError:
    pass

from app.services.gmail_service import get_gmail_client
from app.services.supabase_service import SupabaseService


async def run_gmail_test(user_id: str) -> None:
    """Load Gmail client for user_id from DB and print the 5 most recent emails."""
    supabase = SupabaseService()
    service = await get_gmail_client(user_id, supabase)
    if not service:
        print("FAIL: Gmail not connected for this user. Connect Gmail from the app Integrations page first.")
        return
    results = service.users().messages().list(userId="me", maxResults=5).execute()
    messages = results.get("messages") or []
    out: List[Dict[str, Any]] = []
    for msg_ref in messages:
        msg_id = msg_ref.get("id")
        if not msg_id:
            continue
        msg = service.users().messages().get(
            userId="me", id=msg_id, format="metadata", metadataHeaders=["Subject", "From"]
        ).execute()
        headers = {
            h["name"].lower(): h["value"]
            for h in (msg.get("payload") or {}).get("headers") or []
        }
        out.append({
            "subject": headers.get("subject", "(no subject)"),
            "sender": headers.get("from", "(unknown)"),
        })
    print("OK: Gmail credentials work. Last 5 emails:")
    for i, e in enumerate(out, 1):
        print(f"  {i}. {e['subject'][:60]} | from: {e['sender']}")
    if not out:
        print("  (No messages in inbox)")


def main() -> None:
    user_id = os.environ.get("GMAIL_TEST_USER_ID") or (sys.argv[1] if len(sys.argv) > 1 else None)
    if not user_id:
        print(
            "Usage: Set GMAIL_TEST_USER_ID or run: python -m tests.test_gmail_integration <user_id>\n"
            "user_id = Supabase Auth user UUID for an account that has connected Gmail."
        )
        sys.exit(1)
    print(f"Testing Gmail for user_id: {user_id}\n")
    asyncio.run(run_gmail_test(user_id))


if __name__ == "__main__":
    main()
