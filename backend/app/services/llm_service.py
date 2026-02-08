"""
LLM service: process notes, generate drafts, touch-date recommendations, confidence.
"""

from typing import Any

from app.core.config import get_settings


# -----------------------------------------------------------------------------
# Response / payload types (structure only)
# -----------------------------------------------------------------------------

class ProcessedNotesResult:
    """Result of process_notes: extracted dates, relationships, metadata."""

    def __init__(
        self,
        dates: list[dict[str, Any]] | None = None,
        relationships: list[dict[str, Any]] | None = None,
        metadata: dict[str, Any] | None = None,
        confidence: float = 0.0,
    ) -> None:
        self.dates = dates or []
        self.relationships = relationships or []
        self.metadata = metadata or {}
        self.confidence = confidence


class ActivityDraft:
    """Single draft with tone and confidence."""

    def __init__(
        self,
        text: str,
        tone: str,
        confidence: float,
    ) -> None:
        self.text = text
        self.tone = tone
        self.confidence = confidence


class TouchDateRecommendationResult:
    """Recommended start/due with confidence."""

    def __init__(
        self,
        recommended_start: str | None,
        recommended_due: str | None,
        confidence: float,
    ) -> None:
        self.recommended_start = recommended_start
        self.recommended_due = recommended_due
        self.confidence = confidence


class LLMServiceError(Exception):
    """Raised when LLM call or parsing fails."""

    def __init__(self, message: str, cause: Exception | None = None):
        self.message = message
        self.cause = cause
        super().__init__(message)


class LLMService:
    """
    LLM service for note processing, draft generation, and recommendations.
    Uses OpenAI or Anthropic per config; confidence scoring on outputs.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._openai_key = settings.openai_api_key
        self._anthropic_key = settings.anthropic_api_key
        # Which provider to use (implement selection logic)
        self._provider = "openai"

    # -------------------------------------------------------------------------
    # Process notes: extract dates, relationships, metadata
    # -------------------------------------------------------------------------

    def process_notes(self, notes: str) -> ProcessedNotesResult:
        """
        Extract dates, relationships, and metadata from free-text notes.
        Returns structured result with confidence score.
        """
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Generate activity drafts (3 tones)
    # -------------------------------------------------------------------------

    def generate_activity_drafts(
        self,
        context: str,
        activity_type: str = "follow_up",
        tones: list[str] | None = None,
    ) -> list[ActivityDraft]:
        """
        Generate draft content in multiple tones (e.g. professional, friendly, concise).
        Default 3 tones if not specified. Each draft has text, tone, confidence.
        """
        if tones is None:
            tones = ["professional", "friendly", "concise"]
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Touch-date recommendations
    # -------------------------------------------------------------------------

    def generate_touch_date_recommendations(
        self,
        notes: str,
        context: dict[str, Any] | None = None,
    ) -> list[TouchDateRecommendationResult]:
        """
        Suggest recommended start and due dates from notes and optional context.
        Returns list of recommendations with confidence per suggestion.
        """
        raise NotImplementedError

    # -------------------------------------------------------------------------
    # Confidence scoring
    # -------------------------------------------------------------------------

    def _compute_confidence(self, raw_output: str, parsed: dict[str, Any]) -> float:
        """
        Compute a confidence score (0–1) for parsed LLM output.
        Implement: heuristic or model-based scoring.
        """
        raise NotImplementedError


def get_llm_service() -> LLMService:
    """Dependency: return an LLMService instance."""
    return LLMService()
