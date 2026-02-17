"""
Gmail API endpoints: test connection (list recent emails).
"""

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user_id
from app.services.gmail_service import get_gmail_client
from app.services.supabase_service import SupabaseService, get_supabase_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/test")
async def gmail_test(
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Use get_gmail_client for the logged-in user and return the 5 most recent
    emails (subject and sender) as JSON. Verifies Gmail connection and token refresh.
    """
    service = await get_gmail_client(user_id, supabase)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gmail not connected. Connect Gmail from Integrations first.",
        )
    try:
        results = service.users().messages().list(userId="me", maxResults=5).execute()
        messages = results.get("messages") or []
        out: List[Dict[str, Any]] = []
        for msg_ref in messages:
            msg_id = msg_ref.get("id")
            if not msg_id:
                continue
            msg = service.users().messages().get(userId="me", id=msg_id, format="metadata", metadataHeaders=["Subject", "From"]).execute()
            headers = {h["name"].lower(): h["value"] for h in (msg.get("payload") or {}).get("headers") or []}
            out.append({
                "subject": headers.get("subject", "(no subject)"),
                "sender": headers.get("from", "(unknown)"),
            })
        return {"emails": out}
    except Exception as e:
        logger.exception("Gmail API error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch Gmail messages. Try reconnecting Gmail.",
        )
