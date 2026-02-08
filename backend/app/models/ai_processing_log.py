"""
Pydantic models for public.ai_processing_logs (Supabase).
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AIProcessingLogBase(BaseModel):
    user_id: UUID
    activity_id: str
    input_notes: str | None = None
    status: str = "completed"
    confidence_scores: dict[str, Any] = {}


class AIProcessingLogCreate(AIProcessingLogBase):
    processed_at: datetime | None = None


class AIProcessingLogUpdate(BaseModel):
    status: str | None = None
    confidence_scores: dict[str, Any] | None = None


class AIProcessingLogInDB(AIProcessingLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    processed_at: datetime
    created_at: datetime


class AIProcessingLog(AIProcessingLogInDB):
    pass
