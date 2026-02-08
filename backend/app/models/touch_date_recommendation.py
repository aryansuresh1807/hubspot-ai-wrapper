"""
Pydantic models for public.touch_date_recommendations (Supabase).
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TouchDateRecommendationBase(BaseModel):
    activity_id: str
    recommended_start: datetime | None = None
    recommended_due: datetime | None = None
    confidence: Decimal | None = None
    applied: bool = False


class TouchDateRecommendationCreate(TouchDateRecommendationBase):
    pass


class TouchDateRecommendationUpdate(BaseModel):
    recommended_start: datetime | None = None
    recommended_due: datetime | None = None
    confidence: Decimal | None = None
    applied: bool | None = None


class TouchDateRecommendationInDB(TouchDateRecommendationBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class TouchDateRecommendation(TouchDateRecommendationInDB):
    pass
