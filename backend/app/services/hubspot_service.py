"""
HubSpot API client and operations.
Authentication, error handling, and retries.
"""

from typing import Any

from app.core.config import get_settings


class HubSpotServiceError(Exception):
    """Raised when a HubSpot API call fails after retries."""

    def __init__(self, message: str, status_code: int | None = None, detail: Any = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(message)


class HubSpotService:
    """
    HubSpot API service. Handles authentication, retries, and errors.
    """

    def __init__(self, api_key: str | None = None) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.hubspot_api_key
        self._base_url = "https://api.hubapi.com"
        # Retry config (structure only)
        self._max_retries = 3
        self._retry_status_codes = (429, 500, 502, 503)

    # -------------------------------------------------------------------------
    # Authentication
    # -------------------------------------------------------------------------

    def _get_headers(self) -> dict[str, str]:
        """Build request headers with auth. Implement: Bearer or query param."""
        raise NotImplementedError

    def _ensure_authenticated(self) -> None:
        """Validate or refresh auth. Implement: check token, refresh if needed."""
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Error handling and retries
    # -------------------------------------------------------------------------

    def _handle_error(self, response: Any) -> None:
        """Interpret error response and raise HubSpotServiceError. Implement."""
        raise NotImplementedError

    def _request_with_retry(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> dict[str, Any] | list[Any]:
        """Execute request with retries on transient failures. Implement."""
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Activities
    # -------------------------------------------------------------------------

    def get_activities(
        self,
        limit: int = 100,
        after: str | None = None,
        **params: Any,
    ) -> dict[str, Any]:
        """
        Fetch activities (engagements/tasks) from HubSpot.
        Returns list and pagination info.
        """
        raise NotImplementedError

    def create_activity(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Create an activity (e.g. task, note) in HubSpot. Returns created object."""
        raise NotImplementedError

    def update_activity(self, activity_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Update an activity by HubSpot ID. Returns updated object."""
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Contacts
    # -------------------------------------------------------------------------

    def get_contacts(
        self,
        limit: int = 100,
        after: str | None = None,
        **params: Any,
    ) -> dict[str, Any]:
        """
        Fetch contacts from HubSpot.
        Returns list and pagination info.
        """
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Accounts (Companies)
    # -------------------------------------------------------------------------

    def get_accounts(
        self,
        limit: int = 100,
        after: str | None = None,
        **params: Any,
    ) -> dict[str, Any]:
        """
        Fetch accounts/companies from HubSpot.
        Returns list and pagination info.
        """
        raise NotImplementedError


def get_hubspot_service(api_key: str | None = None) -> HubSpotService:
    """Dependency: return a HubSpotService instance."""
    return HubSpotService(api_key=api_key)
