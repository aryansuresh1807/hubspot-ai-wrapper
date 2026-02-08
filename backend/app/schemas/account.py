"""
Account schema (API contract). Kept in sync with frontend types/Account.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AccountBase(BaseModel):
    name: str | None = None
    domain: str | None = None
    hubspot_id: str | None = None


class Account(AccountBase):
    """Response schema; matches frontend Account interface."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
