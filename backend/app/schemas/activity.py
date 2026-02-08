"""
Activity schema (API contract). Kept in sync with frontend types/Activity.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


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
