# Domain models: HubSpot-facing (activity, contact, account) and Supabase DB models

from app.models.session import (
    Session,
    SessionCreate,
    SessionInDB,
    SessionUpdate,
)
from app.models.ai_processing_log import (
    AIProcessingLog,
    AIProcessingLogCreate,
    AIProcessingLogInDB,
    AIProcessingLogUpdate,
)
from app.models.ai_generated_draft import (
    AIGeneratedDraft,
    AIGeneratedDraftCreate,
    AIGeneratedDraftInDB,
    AIGeneratedDraftUpdate,
)
from app.models.touch_date_recommendation import (
    TouchDateRecommendation,
    TouchDateRecommendationCreate,
    TouchDateRecommendationInDB,
    TouchDateRecommendationUpdate,
)
from app.models.opportunity import (
    Opportunity,
    OpportunityCreate,
    OpportunityInDB,
    OpportunityUpdate,
)

__all__ = [
    "Session",
    "SessionCreate",
    "SessionInDB",
    "SessionUpdate",
    "AIProcessingLog",
    "AIProcessingLogCreate",
    "AIProcessingLogInDB",
    "AIProcessingLogUpdate",
    "AIGeneratedDraft",
    "AIGeneratedDraftCreate",
    "AIGeneratedDraftInDB",
    "AIGeneratedDraftUpdate",
    "TouchDateRecommendation",
    "TouchDateRecommendationCreate",
    "TouchDateRecommendationInDB",
    "TouchDateRecommendationUpdate",
    "Opportunity",
    "OpportunityCreate",
    "OpportunityInDB",
    "OpportunityUpdate",
]
