"""
Gmail API endpoints: test connection, search, get message, extract contact from email.
"""

import base64
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.security import get_current_user_id
from app.services.claude_agents import extract_contact_from_email
from app.services.gmail_service import get_gmail_client
from app.services.supabase_service import SupabaseService, get_supabase_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_body_from_payload(payload: dict) -> str:
    """Extract plain-text body from Gmail message payload (handles multipart)."""
    if not payload:
        return ""
    parts = payload.get("parts") or []
    body_data = payload.get("body", {})
    if body_data.get("data") and (payload.get("mimeType") or "").startswith("text/"):
        try:
            return base64.urlsafe_b64decode(body_data["data"].encode()).decode("utf-8", errors="replace")
        except Exception:
            return ""
    text_parts: List[str] = []
    for part in parts:
        mime = (part.get("mimeType") or "").lower()
        if mime == "text/plain":
            b = part.get("body", {}) or {}
            if b.get("data"):
                try:
                    text_parts.append(base64.urlsafe_b64decode(b["data"].encode()).decode("utf-8", errors="replace"))
                except Exception:
                    pass
        elif mime.startswith("multipart/"):
            text_parts.append(_get_body_from_payload(part))
    if text_parts:
        return "\n".join(text_parts)
    if body_data.get("data"):
        try:
            return base64.urlsafe_b64decode(body_data["data"].encode()).decode("utf-8", errors="replace")
        except Exception:
            pass
    return ""


def _headers_map(msg: dict) -> Dict[str, str]:
    headers = (msg.get("payload") or {}).get("headers") or []
    return {h.get("name", "").lower(): h.get("value", "") for h in headers if h.get("name")}


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


@router.get("/search")
async def gmail_search(
    q: str = Query(..., min_length=1, description="Gmail search query (keywords)"),
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Search user's Gmail with the given query (Gmail search syntax).
    Returns list of messages with id, subject, from, to, snippet, date.
    """
    service = await get_gmail_client(user_id, supabase)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gmail not connected. Connect Gmail from Integrations first.",
        )
    try:
        results = service.users().messages().list(
            userId="me",
            q=q.strip(),
            maxResults=20,
        ).execute()
        messages = results.get("messages") or []
        out: List[Dict[str, Any]] = []
        for msg_ref in messages:
            msg_id = msg_ref.get("id")
            if not msg_id:
                continue
            msg = service.users().messages().get(
                userId="me",
                id=msg_id,
                format="metadata",
                metadataHeaders=["Subject", "From", "To", "Date"],
            ).execute()
            headers = _headers_map(msg)
            snippet = (msg.get("snippet") or "").strip()
            out.append({
                "id": msg_id,
                "subject": headers.get("subject", "(no subject)"),
                "from": headers.get("from", "(unknown)"),
                "to": headers.get("to", ""),
                "snippet": snippet[:200] + ("..." if len(snippet) > 200 else ""),
                "date": headers.get("date", ""),
            })
        return {"messages": out}
    except Exception as e:
        logger.exception("Gmail search error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to search Gmail. Try reconnecting Gmail.",
        )


@router.get("/messages/{message_id}")
async def gmail_get_message(
    message_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Get a single Gmail message by id. Returns from, to, subject, and body (plain text).
    """
    service = await get_gmail_client(user_id, supabase)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gmail not connected. Connect Gmail from Integrations first.",
        )
    try:
        msg = service.users().messages().get(
            userId="me",
            id=message_id,
            format="full",
        ).execute()
        headers = _headers_map(msg)
        body = _get_body_from_payload(msg.get("payload") or {})
        return {
            "id": message_id,
            "from": headers.get("from", ""),
            "to": headers.get("to", ""),
            "subject": headers.get("subject", ""),
            "body": body,
        }
    except Exception as e:
        logger.exception("Gmail get message error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch message. Try reconnecting Gmail.",
        )


class ExtractContactRequest(BaseModel):
    message_id: str


@router.post("/extract-contact")
async def gmail_extract_contact(
    body: ExtractContactRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Fetch the given Gmail message and extract contact/company fields using Claude.
    Returns structured extraction for contact form.
    """
    message_id = (body.message_id or "").strip()
    if not message_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message_id is required")
    service = await get_gmail_client(user_id, supabase)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gmail not connected. Connect Gmail from Integrations first.",
        )
    try:
        msg = service.users().messages().get(
            userId="me",
            id=message_id,
            format="full",
        ).execute()
    except Exception as e:
        logger.exception("Gmail get message for extract: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch message.",
        )
    headers = _headers_map(msg)
    email_from = headers.get("from", "")
    email_to = headers.get("to", "")
    subject = headers.get("subject", "")
    body_text = _get_body_from_payload(msg.get("payload") or {})
    extracted = extract_contact_from_email(
        sender=email_from,
        to=email_to,
        subject=subject,
        body=body_text,
    )
    return extracted
