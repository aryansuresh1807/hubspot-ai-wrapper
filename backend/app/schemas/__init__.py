# Pydantic request/response schemas (API contract). Kept in sync with frontend types.

from app.schemas.common import ErrorDetail, MessageResponse, PaginatedResponse
from app.schemas.activity import Activity, ActivityCreate, ActivityUpdate
from app.schemas.contact import Contact
from app.schemas.account import Account
from app.schemas.ai_processing import (
    AIProcessingResult,
    Draft,
    DraftCreate,
    ExtractedDate,
    ExtractedRelationship,
    TouchDateRecommendation,
    TouchDateRecommendationCreate,
)

__all__ = [
    "MessageResponse",
    "ErrorDetail",
    "PaginatedResponse",
    "Activity",
    "ActivityCreate",
    "ActivityUpdate",
    "Contact",
    "Account",
    "AIProcessingResult",
    "ExtractedDate",
    "ExtractedRelationship",
    "Draft",
    "DraftCreate",
    "TouchDateRecommendation",
    "TouchDateRecommendationCreate",
]
