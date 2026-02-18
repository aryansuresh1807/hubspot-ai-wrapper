"""
Gmail API endpoints: test connection, search, get message, extract contact from email.
"""

import base64
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.security import get_current_user_id
from app.services.claude_agents import extract_contact_from_email, generate_activity_note_from_email
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
    folder: str = Query("all", description="Search in: all, inbox, sent"),
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Search user's Gmail with the given query (Gmail search syntax).
    folder: all (default), inbox, or sent.
    Returns list of messages with id, subject, from, to, snippet, date.
    """
    service = await get_gmail_client(user_id, supabase)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gmail not connected. Connect Gmail from Integrations first.",
        )
    folder_lower = (folder or "all").strip().lower()
    label_ids = None
    if folder_lower == "inbox":
        label_ids = ["INBOX"]
    elif folder_lower == "sent":
        label_ids = ["SENT"]
    try:
        list_kwargs: Dict[str, Any] = {
            "userId": "me",
            "q": q.strip(),
            "maxResults": 20,
        }
        if label_ids is not None:
            list_kwargs["labelIds"] = label_ids
        results = service.users().messages().list(**list_kwargs).execute()
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
            internal_date_ms = msg.get("internalDate")
            internal_ts = int(internal_date_ms) if internal_date_ms else 0
            label_ids = (msg.get("labelIds") or []) if isinstance(msg.get("labelIds"), list) else []
            has_inbox = "INBOX" in label_ids
            has_sent = "SENT" in label_ids
            if has_sent and has_inbox:
                msg_folder = "both"
            elif has_sent:
                msg_folder = "sent"
            elif has_inbox:
                msg_folder = "inbox"
            else:
                msg_folder = "inbox" if folder_lower == "inbox" else "sent" if folder_lower == "sent" else "inbox"
            date_iso = ""
            if internal_ts:
                try:
                    dt = datetime.fromtimestamp(internal_ts / 1000.0, tz=timezone.utc)
                    date_iso = dt.isoformat()
                except (OSError, ValueError):
                    pass
            out.append({
                "id": msg_id,
                "subject": headers.get("subject", "(no subject)"),
                "from": headers.get("from", "(unknown)"),
                "to": headers.get("to", ""),
                "snippet": snippet[:200] + ("..." if len(snippet) > 200 else ""),
                "date": headers.get("date", ""),
                "date_iso": date_iso,
                "folder": msg_folder,
                "_internalDate": internal_ts,
            })
        # Ensure reverse chronological order (latest on top)
        out.sort(key=lambda m: m.get("_internalDate") or 0, reverse=True)
        for m in out:
            m.pop("_internalDate", None)
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


class GenerateActivityNoteRequest(BaseModel):
    message_id: str


@router.post("/generate-activity-note")
async def gmail_generate_activity_note(
    body: GenerateActivityNoteRequest,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Fetch the given Gmail message and use Claude to generate a brief activity note
    from the email content. The note is returned and can be placed in the activity
    Notes field so the user does not have to write it manually.
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
        logger.exception("Gmail get message for generate-activity-note: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch message.",
        )
    headers = _headers_map(msg)
    email_from = headers.get("from", "")
    email_to = headers.get("to", "")
    subject = headers.get("subject", "")
    body_text = _get_body_from_payload(msg.get("payload") or {})
    note = generate_activity_note_from_email(
        sender=email_from,
        to=email_to,
        subject=subject,
        body=body_text,
    )
    return {"note": note or ""}


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
    tokens_row = await supabase.get_gmail_tokens(user_id)
    if not tokens_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gmail not connected. Connect Gmail from Integrations first.",
        )
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
    user_email = (tokens_row.get("email") or "").strip() or None
    extracted = extract_contact_from_email(
        sender=email_from,
        to=email_to,
        subject=subject,
        body=body_text,
        user_email=user_email,
    )
    return extracted
