"""
Contacts endpoints (HubSpot contacts).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("/")
def contacts_root():
    """Placeholder: Contacts endpoints."""
    return {"message": "Contacts endpoints"}
