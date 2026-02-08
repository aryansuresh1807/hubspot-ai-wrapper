"""
AI processing schemas (API contract). Kept in sync with frontend types.
AIProcessingResult, Draft, TouchDateRecommendation.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


# -----------------------------------------------------------------------------
# AIProcessingResult (process_notes response)
# -----------------------------------------------------------------------------

class ExtractedDate(BaseModel):
    date: str
    label: str | None = None


class ExtractedRelationship(BaseModel):
    type: str | None = None
    name: str | None = None
    identifier: str | None = None


class AIProcessingResult(BaseModel):
    """Response schema; matches frontend AIProcessingResult interface."""
    dates: list[ExtractedDate] = []
    relationships: list[ExtractedRelationship] = []
    metadata: dict[str, Any] = {}
    confidence: float = 0.0


# -----------------------------------------------------------------------------
# Draft (AI-generated draft)
# -----------------------------------------------------------------------------

class DraftBase(BaseModel):
    activity_id: str | None = None
    draft_text: str
    tone: str
    confidence: float = 0.0
    selected: bool = False


class DraftCreate(DraftBase):
    """Request body for creating a draft."""
    pass


class Draft(DraftBase):
    """Response schema; matches frontend Draft interface."""
    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    created_at: datetime | None = None


# -----------------------------------------------------------------------------
# TouchDateRecommendation
# -----------------------------------------------------------------------------

class TouchDateRecommendationBase(BaseModel):
    activity_id: str | None = None
    recommended_start: datetime | None = None
    recommended_due: datetime | None = None
    confidence: float = 0.0
    applied: bool = False


class TouchDateRecommendationCreate(TouchDateRecommendationBase):
    """Request body for creating a recommendation."""
    pass


class TouchDateRecommendation(TouchDateRecommendationBase):
    """Response schema; matches frontend TouchDateRecommendation interface."""
    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    created_at: datetime | None = None
