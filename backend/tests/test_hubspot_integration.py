"""
Integration tests for HubSpot service and activities API.

How to run:
-----------
1. From the backend directory, ensure .env is configured (see backend/.env.example).
   Required for HubSpot: HUBSPOT_ACCESS_TOKEN (or HUBSPOT_API_KEY).
   Required for activities auth test: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY.

2. Run with Python from the backend directory so 'app' is importable:
   cd backend
   python -m tests.test_hubspot_integration

   Or with pytest (if installed):
   cd backend
   pytest tests/test_hubspot_integration.py -v -s

3. Optional env vars for the activities test (section 4):
   - BASE_URL: API base URL (default: http://localhost:8000)
   - BEARER_TOKEN: Valid JWT to call /api/v1/activities (skips sign-in)
   - Or set TEST_EMAIL and TEST_PASSWORD to sign in and get a token automatically.

4. For the activities endpoint test, the API server must be running, e.g.:
   uvicorn app.main:app --reload --port 8000
"""

import os
import sys
from datetime import datetime, timezone

# Backend root (parent of tests/) — load .env from here so token is available
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if __name__ == "__main__":
    sys.path.insert(0, _BACKEND_DIR)

# Load .env from backend directory so HUBSPOT_ACCESS_TOKEN is set before app config is read
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_BACKEND_DIR, ".env"))
except ImportError:
    pass  # python-dotenv optional; rely on env already set or pydantic's .env load

import requests

from app.services.hubspot_service import HubSpotService, HubSpotServiceError, get_hubspot_service


def test_hubspot_connection() -> None:
    """1. Test HubSpot service connection by fetching a small batch of contacts."""
    print("\n--- 1. Testing HubSpot connection ---")
    hubspot = get_hubspot_service()
    try:
        data = hubspot.get_contacts(limit=5)
        results = data.get("results") or []
        print(f"   OK: Connected. Got {len(results)} contact(s).")
    except HubSpotServiceError as e:
        print(f"   FAIL: {e.message}")
        raise


def fetch_and_print_contacts() -> None:
    """2. Fetch a few contacts and print them."""
    print("\n--- 2. Fetching and printing contacts ---")
    hubspot = get_hubspot_service()
    data = hubspot.get_contacts(limit=5)
    results = data.get("results") or []
    for i, c in enumerate(results, 1):
        props = c.get("properties") or {}
        name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip() or "(no name)"
        email = props.get("email", "—")
        print(f"   {i}. {name} | {email} | id={c.get('id', '')}")
    if not results:
        print("   (No contacts in HubSpot yet)")


def test_create_contact() -> str | None:
    """3. Create a test contact and return its ID (caller may delete later)."""
    print("\n--- 3. Creating a test contact ---")
    hubspot = get_hubspot_service()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    email = f"test.integration.{ts}@example.com"
    payload = {
        "properties": {
            "email": email,
            "firstname": "Integration",
            "lastname": f"Test_{ts}",
        }
    }
    try:
        data = hubspot.create_contact(payload)
        cid = data.get("id")
        print(f"   OK: Created contact id={cid} | {email}")
        return cid
    except HubSpotServiceError as e:
        print(f"   FAIL: {e.message}")
        raise


def test_activities_with_auth() -> None:
    """4. Test the activities endpoint with authentication."""
    print("\n--- 4. Testing activities endpoint (with auth) ---")
    base_url = (os.environ.get("BASE_URL") or "http://localhost:8000").rstrip("/")
    token = os.environ.get("BEARER_TOKEN")
    email = os.environ.get("TEST_EMAIL")
    password = os.environ.get("TEST_PASSWORD")

    if not token and (email and password):
        # Sign in to get token
        try:
            r = requests.post(
                f"{base_url}/api/v1/auth/signin",
                json={"email": email, "password": password},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            r.raise_for_status()
            token = r.json().get("access_token")
        except requests.RequestException as e:
            print(f"   FAIL: Sign-in failed: {e}")
            if hasattr(e, "response") and e.response is not None:
                print(f"   Response: {e.response.status_code} {e.response.text[:200]}")
            return

    if not token:
        print("   SKIP: Set BEARER_TOKEN or TEST_EMAIL and TEST_PASSWORD (and run API server).")
        return

    try:
        r = requests.get(
            f"{base_url}/api/v1/activities/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        activities = data.get("activities") or []
        print(f"   OK: GET /api/v1/activities/ returned {len(activities)} activity(ies).")
        for i, a in enumerate(activities[:5], 1):
            subj = a.get("subject") or "(no subject)"
            print(f"      {i}. {subj}")
    except requests.RequestException as e:
        print(f"   FAIL: Activities request failed: {e}")
        if hasattr(e, "response") and e.response is not None:
            print(f"   Response: {e.response.status_code} {e.response.text[:300]}")
        raise


def main() -> None:
    print("HubSpot integration tests")
    test_hubspot_connection()
    fetch_and_print_contacts()
    created_id = None
    try:
        created_id = test_create_contact()
    except HubSpotServiceError:
        pass
    test_activities_with_auth()
    if created_id:
        print("\n--- Cleanup: deleting test contact ---")
        try:
            get_hubspot_service().delete_contact(created_id)
            print(f"   Deleted contact {created_id}")
        except HubSpotServiceError as e:
            print(f"   (Could not delete: {e.message})")
    print("\nDone.")


if __name__ == "__main__":
    main()
