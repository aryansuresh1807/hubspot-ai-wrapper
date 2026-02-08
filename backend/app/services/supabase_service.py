"""
Supabase client: auth helpers, database operations, session management.
"""

from typing import Any
from uuid import UUID

from app.core.config import get_settings


class SupabaseServiceError(Exception):
    """Raised when a Supabase operation fails."""

    def __init__(self, message: str, detail: Any = None):
        self.message = message
        self.detail = detail
        super().__init__(message)


class SupabaseService:
    """
    Supabase service for auth, DB access, and session management.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._url = settings.supabase_url
        self._service_key = settings.supabase_service_key
        self._client: Any = None  # Supabase client instance

    # -------------------------------------------------------------------------
    # Client lifecycle
    # -------------------------------------------------------------------------

    def get_client(self) -> Any:
        """Return or create Supabase client (service role). Implement."""
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Authentication helpers
    # -------------------------------------------------------------------------

    def get_user_by_id(self, user_id: UUID) -> dict[str, Any] | None:
        """Fetch user from auth.users by id. Implement via Admin API or RPC."""
        raise NotImplementedError

    def verify_token(self, access_token: str) -> dict[str, Any] | None:
        """Verify JWT and return payload (e.g. sub, email). Implement."""
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Session management
    # -------------------------------------------------------------------------

    def create_session(
        self,
        user_id: UUID,
        expires_at: Any,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Insert row into public.sessions. Returns created session."""
        raise NotImplementedError

    def get_session(self, session_id: UUID) -> dict[str, Any] | None:
        """Get session by id. Returns None if not found or expired."""
        raise NotImplementedError

    def update_session(
        self,
        session_id: UUID,
        expires_at: Any | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """Update session. Returns updated row or None."""
        raise NotImplementedError

    def delete_session(self, session_id: UUID) -> bool:
        """Delete session. Returns True if deleted."""
        raise NotImplementedError

    def delete_expired_sessions(self, older_than_seconds: int = 0) -> int:
        """Remove sessions past expires_at. Returns count deleted. Implement."""
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Database operations (generic / tables)
    # -------------------------------------------------------------------------

    def insert(self, table: str, row: dict[str, Any]) -> dict[str, Any]:
        """Insert one row into table. Returns inserted row (with id, timestamps)."""
        raise NotImplementedError

    def select_one(
        self,
        table: str,
        columns: str | list[str] | None = None,
        filters: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """Select single row. Returns None if not found."""
        raise NotImplementedError

    def select_many(
        self,
        table: str,
        columns: str | list[str] | None = None,
        filters: dict[str, Any] | None = None,
        order: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Select rows with optional filters, order, limit, offset."""
        raise NotImplementedError

    def update(
        self,
        table: str,
        id_value: Any,
        id_column: str = "id",
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """Update row by id. Returns updated row or None."""
        raise NotImplementedError

    def delete(self, table: str, id_value: Any, id_column: str = "id") -> bool:
        """Delete row by id. Returns True if deleted."""
        raise NotImplementedError


def get_supabase_service() -> SupabaseService:
    """Dependency: return a SupabaseService instance."""
    return SupabaseService()
