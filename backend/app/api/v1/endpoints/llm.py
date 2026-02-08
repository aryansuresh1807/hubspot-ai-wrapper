"""
LLM / AI processing endpoints.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/")
def llm_root():
    """Placeholder: LLM endpoints."""
    return {"message": "LLM endpoints"}
