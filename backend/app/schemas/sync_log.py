"""Sync log schema (API contract). Used by Integrations sync log UI."""

from typing import Any

from pydantic import BaseModel, ConfigDict


class SyncLogEntry(BaseModel):
    """Single sync log entry."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    action: str
    status: str  # 'success' | 'error'
    started_at: str
    finished_at: str
    duration_ms: int
    details: str | None = None
    metadata: dict[str, Any] = {}
    created_at: str | None = None


class SyncLogListResponse(BaseModel):
    """Paginated sync log list."""
    entries: list[SyncLogEntry]
    total: int
    page: int
    page_size: int
