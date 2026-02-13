"""
Contact schema (API contract). Kept in sync with frontend types/Contact.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ContactBase(BaseModel):
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    company_id: str | None = None
    company_name: str | None = None
    hubspot_id: str | None = None
    phone: str | None = None
    mobile_phone: str | None = None
    job_title: str | None = None
    relationship_status: str | None = None
    notes: str | None = None


class Contact(ContactBase):
    """Response schema; matches frontend Contact interface."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ContactCreate(BaseModel):
    """Request body for creating a contact. first_name, last_name, email required."""
    first_name: str = Field(..., min_length=1, description="First name")
    last_name: str = Field(..., min_length=1, description="Last name")
    email: str = Field(..., min_length=1, description="Email address")
    phone: str | None = None
    job_title: str | None = None
    company_id: str | None = None
    relationship_status: str | None = None
    notes: str | None = None


class ContactUpdate(BaseModel):
    """Request body for partial update."""
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    job_title: str | None = None
    company_id: str | None = None
    relationship_status: str | None = None
    notes: str | None = None


class ContactListResponse(BaseModel):
    """List of contacts."""
    contacts: list[Contact]


class ContactDetailResponse(Contact):
    """Single contact detail (same as Contact; alias for clarity)."""
    pass
