"""
Activity schema (API contract). Kept in sync with frontend types/Activity.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

# Sort options for activity list
ActivitySortOption = Literal[
    "date_newest",
    "date_oldest",
    "priority_high_low",
    "opportunity_pct",
    "relationship_status",
]


class ActivityBase(BaseModel):
    type: str | None = None
    subject: str | None = None
    body: str | None = None
    due_date: datetime | None = None
    completed: bool = False
    contact_ids: list[str] = []
    company_ids: list[str] = []
    hubspot_id: str | None = None


class ActivityCreate(ActivityBase):
    """Request body for creating an activity."""
    pass


class ActivityUpdate(BaseModel):
    """Request body for partial update."""
    type: str | None = None
    subject: str | None = None
    body: str | None = None
    due_date: datetime | None = None
    completed: bool | None = None
    contact_ids: list[str] | None = None
    company_ids: list[str] | None = None


class Activity(ActivityBase):
    """Response schema; matches frontend Activity interface."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ContactInfo(BaseModel):
    """Minimal contact info for activity enrichment."""
    id: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    hubspot_id: str | None = None


class CompanyInfo(BaseModel):
    """Minimal company info for activity enrichment."""
    id: str
    name: str | None = None
    domain: str | None = None
    hubspot_id: str | None = None


class ActivityResponse(Activity):
    """Activity with optional contact and company details."""
    contacts: list[ContactInfo] = []
    companies: list[CompanyInfo] = []


class ActivityListResponse(BaseModel):
    """List of activities (with optional contact/company info)."""
    activities: list[ActivityResponse]


class SyncStatusResponse(BaseModel):
    """Response for force-sync endpoint."""
    synced: bool
    message: str
    tasks_count: int = 0
