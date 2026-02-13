"""
Dashboard state endpoints (user_dashboard_state).
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user_id
from app.schemas.dashboard import (
    DashboardStateResponse,
    DashboardStateUpdate,
)
from app.services.supabase_service import SupabaseService, get_supabase_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DEFAULT_SORT_OPTION = "date_newest"


@router.get(
    "/state",
    response_model=DashboardStateResponse,
    summary="Get dashboard state",
    description="Fetch current user's dashboard state. Returns defaults if none exists.",
)
async def get_dashboard_state(
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> DashboardStateResponse:
    """GET /api/v1/dashboard/state — fetch user's dashboard state or defaults."""
    try:
        state = await supabase.get_dashboard_state(user_id)
        if not state:
            return DashboardStateResponse(
                selected_activity_id=None,
                sort_option=DEFAULT_SORT_OPTION,
                filter_state={},
                date_picker_value=None,
                updated_at=None,
            )
        return DashboardStateResponse(
            selected_activity_id=state.get("selected_activity_id"),
            sort_option=state.get("sort_option") or DEFAULT_SORT_OPTION,
            filter_state=state.get("filter_state") or {},
            date_picker_value=state.get("date_picker_value"),
            updated_at=state.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch dashboard state",
        )


@router.put(
    "/state",
    response_model=DashboardStateResponse,
    summary="Update dashboard state",
    description="Upsert user's dashboard state. Only provided fields are updated.",
)
async def put_dashboard_state(
    body: DashboardStateUpdate,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> DashboardStateResponse:
    """PUT /api/v1/dashboard/state — upsert dashboard state and return updated state."""
    try:
        data = body.model_dump(exclude_none=True)
        if not data:
            # No fields to update: return current state
            state = await supabase.get_dashboard_state(user_id)
            if not state:
                return DashboardStateResponse(
                    selected_activity_id=None,
                    sort_option=DEFAULT_SORT_OPTION,
                    filter_state={},
                    date_picker_value=None,
                    updated_at=None,
                )
            return DashboardStateResponse(
                selected_activity_id=state.get("selected_activity_id"),
                sort_option=state.get("sort_option") or DEFAULT_SORT_OPTION,
                filter_state=state.get("filter_state") or {},
                date_picker_value=state.get("date_picker_value"),
                updated_at=state.get("updated_at"),
            )
        updated = await supabase.upsert_dashboard_state(user_id, data)
        return DashboardStateResponse(
            selected_activity_id=updated.get("selected_activity_id"),
            sort_option=updated.get("sort_option") or DEFAULT_SORT_OPTION,
            filter_state=updated.get("filter_state") or {},
            date_picker_value=updated.get("date_picker_value"),
            updated_at=updated.get("updated_at"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update dashboard state",
        )
