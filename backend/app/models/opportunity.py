"""
Pydantic models for public.opportunities (Supabase).
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OpportunityBase(BaseModel):
    user_id: UUID
    hubspot_activity_id: str | None = None
    probability: Decimal | None = None
    status: str = "open"


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    hubspot_activity_id: str | None = None
    probability: Decimal | None = None
    status: str | None = None


class OpportunityInDB(OpportunityBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class Opportunity(OpportunityInDB):
    pass
