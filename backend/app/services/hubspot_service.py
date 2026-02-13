"""
HubSpot API v3 client and operations.
Uses Bearer token auth, requests library, error handling, and rate limiting awareness.
"""

import logging
import time
from collections import deque
from typing import Any

import requests

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# HubSpot rate limit: 100 requests per 10 seconds (Starter); we throttle to stay under.
RATE_LIMIT_WINDOW_SEC = 10
RATE_LIMIT_MAX_REQUESTS = 95  # leave small headroom


class HubSpotServiceError(Exception):
    """Raised when a HubSpot API call fails."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        detail: Any = None,
    ) -> None:
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(message)


class HubSpotService:
    """
    HubSpot API v3 service. Bearer token auth, retries on 429/5xx, rate limiting awareness.
    """

    def __init__(self, access_token: str | None = None) -> None:
        settings = get_settings()
        self._token = access_token or settings.hubspot_access_token or settings.hubspot_api_key
        self._base_url = "https://api.hubapi.com"
        self._max_retries = 3
        self._retry_status_codes = (429, 500, 502, 503)
        # Rate limiting: timestamps of recent requests (within last RATE_LIMIT_WINDOW_SEC)
        self._request_timestamps: deque[float] = deque(maxlen=RATE_LIMIT_MAX_REQUESTS + 10)

    def _get_headers(self) -> dict[str, str]:
        """Build request headers with Bearer token."""
        if not self._token:
            raise HubSpotServiceError(
                "HubSpot access token not configured. Set HUBSPOT_ACCESS_TOKEN in environment."
            )
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    def _rate_limit_wait(self) -> None:
        """If we've hit the request count in the window, sleep until oldest request exits the window."""
        now = time.monotonic()
        # Drop timestamps outside the window
        while self._request_timestamps and now - self._request_timestamps[0] >= RATE_LIMIT_WINDOW_SEC:
            self._request_timestamps.popleft()
        if len(self._request_timestamps) >= RATE_LIMIT_MAX_REQUESTS:
            sleep_time = RATE_LIMIT_WINDOW_SEC - (now - self._request_timestamps[0])
            if sleep_time > 0:
                logger.warning(
                    "HubSpot rate limit approaching: sleeping %.1fs (limit %d/%ds)",
                    sleep_time,
                    RATE_LIMIT_MAX_REQUESTS,
                    RATE_LIMIT_WINDOW_SEC,
                )
                time.sleep(sleep_time)
            self._request_timestamps.clear()

    def _handle_error(self, response: requests.Response) -> None:
        """Interpret error response and raise HubSpotServiceError with detail."""
        try:
            body = response.json()
        except Exception:
            body = response.text or None
        msg = f"HubSpot API error: {response.status_code}"
        if isinstance(body, dict):
            detail = body.get("message") or body.get("status") or body
            if body.get("category"):
                msg += f" ({body['category']})"
            if isinstance(detail, str):
                msg += f" — {detail}"
        elif isinstance(body, str) and body:
            msg += f" — {body[:500]}"
        raise HubSpotServiceError(msg, status_code=response.status_code, detail=body)

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | list[Any] | None = None,
        retries: int | None = None,
    ) -> dict[str, Any] | list[Any]:
        """
        Execute HTTP request with rate limiting and retries on 429/5xx.
        path: e.g. /crm/v3/objects/contacts (no leading slash required).
        """
        retries = self._max_retries if retries is None else retries
        url = f"{self._base_url.rstrip('/')}/{path.lstrip('/')}"
        headers = self._get_headers()
        last_exc: Exception | None = None

        for attempt in range(retries + 1):
            self._rate_limit_wait()
            self._request_timestamps.append(time.monotonic())

            try:
                resp = requests.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json,
                    timeout=30,
                )
            except requests.RequestException as e:
                last_exc = e
                logger.warning("HubSpot request failed (attempt %d): %s", attempt + 1, e)
                if attempt < retries:
                    time.sleep(2 ** attempt)
                continue

            if resp.ok:
                if resp.status_code == 204:
                    return {}
                if not resp.content:
                    return {}
                return resp.json()

            if resp.status_code in self._retry_status_codes and attempt < retries:
                retry_after = resp.headers.get("Retry-After")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else (2 ** attempt)
                logger.warning(
                    "HubSpot %s %s (attempt %d), retrying in %.1fs",
                    resp.status_code,
                    resp.reason,
                    attempt + 1,
                    wait,
                )
                time.sleep(wait)
                continue

            self._handle_error(resp)

        if last_exc:
            raise HubSpotServiceError(
                f"HubSpot request failed after {retries + 1} attempts: {last_exc!s}"
            ) from last_exc
        raise HubSpotServiceError("HubSpot request failed unexpectedly")

    # -------------------------------------------------------------------------
    # Contacts
    # -------------------------------------------------------------------------

    def get_contacts(
        self,
        limit: int = 100,
        after: str | None = None,
        properties: list[str] | None = None,
    ) -> dict[str, Any]:
        """Fetch all contacts from HubSpot. Returns list and pagination info."""
        params: dict[str, Any] = {"limit": min(limit, 100)}
        if after:
            params["after"] = after
        if properties:
            params["properties"] = ",".join(properties)
        try:
            data = self._request("GET", "/crm/v3/objects/contacts", params=params)
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to fetch contacts: {e!s}") from e
        return data if isinstance(data, dict) else {"results": data}

    def get_contact(
        self,
        contact_id: str,
        properties: list[str] | None = None,
    ) -> dict[str, Any]:
        """Fetch a single contact by ID."""
        params: dict[str, Any] = {}
        if properties:
            params["properties"] = ",".join(properties)
        try:
            data = self._request(
                "GET",
                f"/crm/v3/objects/contacts/{contact_id}",
                params=params or None,
            )
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to fetch contact {contact_id}: {e!s}") from e
        if not isinstance(data, dict):
            raise HubSpotServiceError(f"Unexpected response for contact {contact_id}")
        return data

    def create_contact(self, contact_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new contact. contact_data can be {'properties': {...}} or flat properties."""
        if "properties" not in contact_data:
            contact_data = {"properties": contact_data}
        try:
            data = self._request("POST", "/crm/v3/objects/contacts", json=contact_data)
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to create contact: {e!s}") from e
        if not isinstance(data, dict):
            raise HubSpotServiceError("Unexpected response when creating contact")
        return data

    def update_contact(
        self,
        contact_id: str,
        contact_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an existing contact by ID."""
        if "properties" not in contact_data:
            contact_data = {"properties": contact_data}
        try:
            data = self._request(
                "PATCH",
                f"/crm/v3/objects/contacts/{contact_id}",
                json=contact_data,
            )
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to update contact {contact_id}: {e!s}") from e
        if not isinstance(data, dict):
            raise HubSpotServiceError(f"Unexpected response when updating contact {contact_id}")
        return data

    def delete_contact(self, contact_id: str) -> None:
        """Archive (soft-delete) a contact by ID."""
        try:
            self._request("DELETE", f"/crm/v3/objects/contacts/{contact_id}")
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to delete contact {contact_id}: {e!s}") from e

    # -------------------------------------------------------------------------
    # Companies
    # -------------------------------------------------------------------------

    def get_companies(
        self,
        limit: int = 100,
        after: str | None = None,
        properties: list[str] | None = None,
    ) -> dict[str, Any]:
        """Fetch all companies from HubSpot. Returns list and pagination info."""
        params: dict[str, Any] = {"limit": min(limit, 100)}
        if after:
            params["after"] = after
        if properties:
            params["properties"] = ",".join(properties)
        try:
            data = self._request("GET", "/crm/v3/objects/companies", params=params)
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to fetch companies: {e!s}") from e
        return data if isinstance(data, dict) else {"results": data}

    def get_company(
        self,
        company_id: str,
        properties: list[str] | None = None,
    ) -> dict[str, Any]:
        """Fetch a single company by ID."""
        params: dict[str, Any] = {}
        if properties:
            params["properties"] = ",".join(properties)
        try:
            data = self._request(
                "GET",
                f"/crm/v3/objects/companies/{company_id}",
                params=params or None,
            )
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to fetch company {company_id}: {e!s}") from e
        if not isinstance(data, dict):
            raise HubSpotServiceError(f"Unexpected response for company {company_id}")
        return data

    def create_company(self, company_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new company. company_data can be {'properties': {...}} or flat properties."""
        if "properties" not in company_data:
            company_data = {"properties": company_data}
        try:
            data = self._request("POST", "/crm/v3/objects/companies", json=company_data)
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to create company: {e!s}") from e
        if not isinstance(data, dict):
            raise HubSpotServiceError("Unexpected response when creating company")
        return data

    # -------------------------------------------------------------------------
    # Tasks (activities)
    # -------------------------------------------------------------------------

    TASK_PROPERTIES = [
        "hs_timestamp",
        "hs_task_subject",
        "hs_task_body",
        "hs_task_status",
        "hs_task_priority",
        "hs_task_type",
        "hs_createdate",
        "hs_lastmodifieddate",
    ]

    def get_tasks(
        self,
        limit: int = 100,
        after: str | None = None,
        properties: list[str] | None = None,
        associations: list[str] | None = None,
    ) -> dict[str, Any]:
        """Fetch all tasks from HubSpot. Returns list and pagination info."""
        params: dict[str, Any] = {"limit": min(limit, 100)}
        if after:
            params["after"] = after
        if properties:
            params["properties"] = ",".join(properties)
        else:
            params["properties"] = ",".join(self.TASK_PROPERTIES)
        if associations:
            params["associations"] = ",".join(associations)
        try:
            data = self._request("GET", "/crm/v3/objects/tasks", params=params)
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to fetch tasks: {e!s}") from e
        return data if isinstance(data, dict) else {"results": data}

    def search_tasks(
        self,
        due_date_from_ms: int | None = None,
        due_date_to_ms: int | None = None,
        limit: int = 100,
        after: str | None = None,
        properties: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Search tasks by due date (hs_timestamp).
        Use POST /crm/v3/objects/tasks/search with filterGroups.
        """
        body: dict[str, Any] = {"limit": min(limit, 100)}
        if after is not None:
            body["after"] = after
        if properties:
            body["properties"] = properties
        else:
            body["properties"] = self.TASK_PROPERTIES.copy()

        filter_groups: list[dict[str, Any]] = []
        if due_date_from_ms is not None or due_date_to_ms is not None:
            filters: list[dict[str, Any]] = []
            if due_date_from_ms is not None:
                filters.append({
                    "propertyName": "hs_timestamp",
                    "operator": "GTE",
                    "value": str(due_date_from_ms),
                })
            if due_date_to_ms is not None:
                filters.append({
                    "propertyName": "hs_timestamp",
                    "operator": "LTE",
                    "value": str(due_date_to_ms),
                })
            if filters:
                filter_groups.append({"filters": filters})
        if filter_groups:
            body["filterGroups"] = filter_groups

        try:
            data = self._request(
                "POST",
                "/crm/v3/objects/tasks/search",
                json=body,
            )
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to search tasks: {e!s}") from e
        if not isinstance(data, dict):
            return {"results": data, "total": len(data) if isinstance(data, list) else 0}
        return data

    def get_task(
        self,
        task_id: str,
        properties: list[str] | None = None,
        associations: list[str] | None = None,
    ) -> dict[str, Any]:
        """Fetch a single task by ID, optionally with associations (e.g. contacts)."""
        params: dict[str, Any] = {}
        if properties:
            params["properties"] = ",".join(properties)
        else:
            params["properties"] = ",".join(self.TASK_PROPERTIES)
        if associations:
            params["associations"] = ",".join(associations)
        try:
            data = self._request(
                "GET",
                f"/crm/v3/objects/tasks/{task_id}",
                params=params or None,
            )
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to fetch task {task_id}: {e!s}") from e
        if not isinstance(data, dict):
            raise HubSpotServiceError(f"Unexpected response for task {task_id}")
        return data

    def get_contacts_batch(
        self,
        contact_ids: list[str],
        properties: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Batch fetch contacts by IDs. HubSpot batch read up to 100 per request."""
        if not contact_ids:
            return []
        props = properties or ["firstname", "lastname", "email", "phone"]
        body: dict[str, Any] = {
            "properties": props,
            "inputs": [{"id": cid} for cid in contact_ids[:100]],
        }
        try:
            data = self._request(
                "POST",
                "/crm/v3/objects/contacts/batch/read",
                json=body,
            )
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to batch fetch contacts: {e!s}") from e
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return []

    def create_task(self, task_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new task. task_data can be {'properties': {...}} or flat properties."""
        if "properties" not in task_data:
            task_data = {"properties": task_data}
        try:
            data = self._request("POST", "/crm/v3/objects/tasks", json=task_data)
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to create task: {e!s}") from e
        if not isinstance(data, dict):
            raise HubSpotServiceError("Unexpected response when creating task")
        return data

    def update_task(
        self,
        task_id: str,
        task_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an existing task by ID."""
        if "properties" not in task_data:
            task_data = {"properties": task_data}
        try:
            data = self._request(
                "PATCH",
                f"/crm/v3/objects/tasks/{task_id}",
                json=task_data,
            )
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to update task {task_id}: {e!s}") from e
        if not isinstance(data, dict):
            raise HubSpotServiceError(f"Unexpected response when updating task {task_id}")
        return data

    def delete_task(self, task_id: str) -> None:
        """Delete (archive) a task by ID. HubSpot returns 204."""
        try:
            self._request("DELETE", f"/crm/v3/objects/tasks/{task_id}")
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to delete task {task_id}: {e!s}") from e

    # -------------------------------------------------------------------------
    # Search
    # -------------------------------------------------------------------------

    def search_contacts(
        self,
        query: str,
        limit: int = 100,
        after: str | None = None,
        properties: list[str] | None = None,
    ) -> dict[str, Any]:
        """
        Search contacts by name/email. Uses HubSpot search default text search
        (firstname, lastname, email, phone, etc.). query is case-insensitive.
        """
        body: dict[str, Any] = {
            "query": query,
            "limit": min(limit, 200),
        }
        if after:
            body["after"] = after
        if properties:
            body["properties"] = properties
        try:
            data = self._request(
                "POST",
                "/crm/v3/objects/contacts/search",
                json=body,
            )
        except HubSpotServiceError:
            raise
        except Exception as e:
            raise HubSpotServiceError(f"Failed to search contacts: {e!s}") from e
        if not isinstance(data, dict):
            raise HubSpotServiceError("Unexpected response when searching contacts")
        return data


def get_hubspot_service(access_token: str | None = None) -> HubSpotService:
    """Dependency: return a HubSpotService instance."""
    return HubSpotService(access_token=access_token)
