"""
Sync log endpoints. List integration sync runs for the Integrations page.
"""

from fastapi import APIRouter, Depends, Query

from app.core.security import get_current_user_id
from app.schemas.sync_log import SyncLogEntry, SyncLogListResponse
from app.services.supabase_service import SupabaseService, get_supabase_service

router = APIRouter(prefix="/sync-logs", tags=["sync-logs"])


@router.get(
    "",
    response_model=SyncLogListResponse,
    summary="List sync logs",
    description="Paginated list of sync log entries for the current user. Filter by status and source.",
)
async def list_sync_logs(
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    status: str = Query("all", description="Filter by status: all, success, error"),
    source: str = Query("all", description="Filter by source: all, hubspot, email"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> SyncLogListResponse:
    """GET /api/v1/sync-logs — list sync log entries with optional filters and pagination."""
    offset = (page - 1) * page_size
    rows, total = await supabase.list_sync_logs(
        user_id=user_id,
        status_filter=status if status != "all" else None,
        source_filter=source if source != "all" else None,
        limit=page_size,
        offset=offset,
    )
    entries = [
        SyncLogEntry(
            id=r["id"],
            source=r["source"],
            action=r["action"],
            status=r["status"],
            started_at=r["started_at"],
            finished_at=r["finished_at"],
            duration_ms=r["duration_ms"],
            details=r.get("details"),
            metadata=r.get("metadata") or {},
            created_at=r.get("created_at"),
        )
        for r in rows
    ]
    return SyncLogListResponse(
        entries=entries,
        total=total,
        page=page,
        page_size=page_size,
    )
