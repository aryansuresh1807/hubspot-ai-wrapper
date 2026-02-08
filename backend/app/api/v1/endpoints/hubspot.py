"""
HubSpot API proxy / integration endpoints.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/hubspot", tags=["hubspot"])


@router.get("/")
def hubspot_root():
    """Placeholder: HubSpot-related endpoints."""
    return {"message": "HubSpot endpoints"}
