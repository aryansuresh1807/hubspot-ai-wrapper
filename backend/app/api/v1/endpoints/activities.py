"""
Activities endpoints (HubSpot activities, tasks).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("/")
def activities_root():
    """Placeholder: Activities endpoints."""
    return {"message": "Activities endpoints"}
