"""
Contact schema (API contract). Kept in sync with frontend types/Contact.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ContactBase(BaseModel):
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    company_id: str | None = None
    hubspot_id: str | None = None


class Contact(ContactBase):
    """Response schema; matches frontend Contact interface."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
