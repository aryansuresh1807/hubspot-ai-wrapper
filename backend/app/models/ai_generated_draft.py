"""
Pydantic models for public.ai_generated_drafts (Supabase).
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AIGeneratedDraftBase(BaseModel):
    activity_id: str
    draft_text: str
    tone: str | None = None
    confidence: Decimal | None = None
    selected: bool = False


class AIGeneratedDraftCreate(AIGeneratedDraftBase):
    pass


class AIGeneratedDraftUpdate(BaseModel):
    draft_text: str | None = None
    tone: str | None = None
    confidence: Decimal | None = None
    selected: bool | None = None


class AIGeneratedDraftInDB(AIGeneratedDraftBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class AIGeneratedDraft(AIGeneratedDraftInDB):
    pass
