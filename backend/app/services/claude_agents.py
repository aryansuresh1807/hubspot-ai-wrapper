"""
Claude LLM agents for activity note processing.
Uses ANTHROPIC_API_KEY; all agents return structured data for the activity page.
"""

import json
import logging
import re
from datetime import datetime, timezone, timedelta

from anthropic import Anthropic

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Default model for all agents
DEFAULT_MODEL = "claude-sonnet-4-20250514"
DEFAULT_MAX_TOKENS = 2048


def _get_client() -> Anthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY is not set")
    return Anthropic(api_key=settings.anthropic_api_key)


def _parse_json_block(text: str) -> dict | list | None:
    """Extract JSON from a markdown code block or raw JSON in the response."""
    text = text.strip()
    # Try to find ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        text = match.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find first { or [ and parse from there
        for start in ("{", "["):
            idx = text.find(start)
            if idx != -1:
                try:
                    return json.loads(text[idx:])
                except json.JSONDecodeError:
                    continue
    return None


# ---------------------------------------------------------------------------
# 1. Summary of communication history
# ---------------------------------------------------------------------------

def summarize_communication_history(full_notes: str) -> str:
    """
    Produce a short summary of the full notes history for this contact.
    Used for the "Summary of Communication History" section (view only).
    """
    if not full_notes or not full_notes.strip():
        return "No communication history yet."
    client = _get_client()
    prompt = """You are an assistant that summarizes client communication history for a sales/relationship manager.

Given the full notes history below (often with date-prefixed entries), write a concise summary that captures:
- Key topics and outcomes discussed
- Any commitments or next steps mentioned over time
- Relationship context that would help the user at a glance

Keep the summary to 2–4 short paragraphs. Write in clear, professional language.

Notes:
"""
    try:
        msg = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=DEFAULT_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt + full_notes}],
        )
        block = msg.content[0] if msg.content else None
        if block and getattr(block, "text", None):
            return block.text.strip()
    except Exception as e:
        logger.exception("Claude summarize_communication_history error: %s", e)
        return "Unable to generate summary. Please try again."
    return "No summary generated."


# ---------------------------------------------------------------------------
# 2. Recognised date (from note text, e.g. "next week")
# ---------------------------------------------------------------------------

def extract_recognised_date(latest_note: str, reference_date: datetime | None = None) -> dict:
    """
    If the note mentions a date or relative date (e.g. "next week", "on Friday"),
    return that date as YYYY-MM-DD and a label. Otherwise return null.
    reference_date: use for "next week" etc.; default now.
    """
    if not latest_note or not latest_note.strip():
        return {"date": None, "label": None, "confidence": 0}
    ref = reference_date or datetime.now(timezone.utc)
    client = _get_client()
    prompt = f"""You are an assistant that extracts explicit or implied dates from meeting/activity notes.

Today's date (reference): {ref.strftime("%Y-%m-%d")} ({ref.strftime("%A, %B %d, %Y")}).

From the following note, determine if the contact or user mentioned a specific date or a relative date (e.g. "next week", "next Wednesday", "in two weeks", "by end of month"). 
If you find one, compute the actual date and return it as YYYY-MM-DD. Also provide a short label (e.g. "Next week", "Next Wednesday").
If no date is mentioned or implied, return null for the date.

Respond with ONLY a JSON object in this exact format, no other text:
{{"date": "YYYY-MM-DD" or null, "label": "short label" or null, "confidence": number 0-100}}
"""
    try:
        msg = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt + "\n\nNote:\n" + latest_note}],
        )
        block = msg.content[0] if msg.content else None
        if block and getattr(block, "text", None):
            parsed = _parse_json_block(block.text)
            if isinstance(parsed, dict):
                date_val = parsed.get("date")
                if date_val and isinstance(date_val, str) and re.match(r"\d{4}-\d{2}-\d{2}", date_val):
                    return {
                        "date": date_val,
                        "label": parsed.get("label") or date_val,
                        "confidence": min(100, max(0, int(parsed.get("confidence", 70)))),
                    }
                return {
                    "date": None,
                    "label": parsed.get("label"),
                    "confidence": min(100, max(0, int(parsed.get("confidence", 0)))),
                }
    except Exception as e:
        logger.exception("Claude extract_recognised_date error: %s", e)
    return {"date": None, "label": None, "confidence": 0}


# ---------------------------------------------------------------------------
# 3. Recommended touch date (next due date suggestion)
# ---------------------------------------------------------------------------

def recommend_touch_date(
    latest_note: str,
    previous_notes: str = "",
    reference_date: datetime | None = None,
) -> dict:
    """
    Based on relationship health and prior meeting patterns, suggest the next due date.
    Returns date (YYYY-MM-DD), label, and rationale.
    """
    ref = reference_date or datetime.now(timezone.utc)
    client = _get_client()
    context = "Previous notes for this contact:\n" + (previous_notes or "None.") if previous_notes else "No previous notes."
    prompt = f"""You are an assistant that suggests the next follow-up (touch) date for a client relationship.

Reference date: {ref.strftime("%Y-%m-%d")} ({ref.strftime("%A")}).

{context}

Latest note:
{latest_note or "No latest note."}

Based on the content (commitments, "let's meet next week", typical follow-up cycles), suggest ONE recommended next touch date as YYYY-MM-DD. Provide a short label (e.g. "1 week from now") and a one-sentence rationale.

Respond with ONLY a JSON object:
{{"date": "YYYY-MM-DD", "label": "short label", "rationale": "one sentence"}}
"""
    try:
        msg = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        block = msg.content[0] if msg.content else None
        if block and getattr(block, "text", None):
            parsed = _parse_json_block(block.text)
            if isinstance(parsed, dict) and parsed.get("date"):
                return {
                    "date": str(parsed["date"])[:10],
                    "label": parsed.get("label") or parsed["date"],
                    "rationale": parsed.get("rationale") or "Based on note context.",
                }
    except Exception as e:
        logger.exception("Claude recommend_touch_date error: %s", e)
    # Fallback: 1 week from now
    one_week = (ref + timedelta(days=7)).strftime("%Y-%m-%d")
    return {"date": one_week, "label": "1 week from now", "rationale": "Default follow-up in one week."}


# ---------------------------------------------------------------------------
# 4. Extracted metadata (subject, next steps, questions, urgency)
# ---------------------------------------------------------------------------

def extract_metadata(latest_note: str, previous_notes: str = "") -> dict:
    """
    Extract subject, next steps, questions raised, and urgency (low/medium/high)
    from the latest note with optional context from previous notes.
    """
    if not latest_note or not latest_note.strip():
        return {
            "subject": "",
            "next_steps": "",
            "questions_raised": "",
            "urgency": "medium",
            "subject_confidence": 0,
            "next_steps_confidence": 0,
            "questions_confidence": 0,
        }
    client = _get_client()
    context = ""
    if previous_notes and previous_notes.strip():
        context = "Previous notes (for context only):\n" + previous_notes + "\n\n"
    prompt = f"""You are an assistant that extracts structured metadata from activity/meeting notes for CRM updates.

{context}Latest note:
{latest_note}

Extract:
1. subject: A short task title (e.g. "Check in with Jane", "Call re: Q4 proposal") — one short phrase.
2. next_steps: Bullet or comma-separated next steps.
3. questions_raised: Any questions the contact raised or that remain open.
4. urgency: One of "low", "medium", "high" based on tone and content.
5. subject_confidence, next_steps_confidence, questions_confidence: 0-100 integers.

Respond with ONLY a JSON object:
{{"subject": "...", "next_steps": "...", "questions_raised": "...", "urgency": "low"|"medium"|"high", "subject_confidence": number, "next_steps_confidence": number, "questions_confidence": number}}
"""
    try:
        msg = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        block = msg.content[0] if msg.content else None
        if block and getattr(block, "text", None):
            parsed = _parse_json_block(block.text)
            if isinstance(parsed, dict):
                urgency = (parsed.get("urgency") or "medium").lower()
                if urgency not in ("low", "medium", "high"):
                    urgency = "medium"
                return {
                    "subject": (parsed.get("subject") or "").strip() or "Follow-up",
                    "next_steps": (parsed.get("next_steps") or "").strip(),
                    "questions_raised": (parsed.get("questions_raised") or "").strip(),
                    "urgency": urgency,
                    "subject_confidence": min(100, max(0, int(parsed.get("subject_confidence", 70)))),
                    "next_steps_confidence": min(100, max(0, int(parsed.get("next_steps_confidence", 70)))),
                    "questions_confidence": min(100, max(0, int(parsed.get("questions_confidence", 70)))),
                }
    except Exception as e:
        logger.exception("Claude extract_metadata error: %s", e)
    return {
        "subject": "Follow-up",
        "next_steps": "",
        "questions_raised": "",
        "urgency": "medium",
        "subject_confidence": 50,
        "next_steps_confidence": 50,
        "questions_confidence": 50,
    }


# ---------------------------------------------------------------------------
# 5. AI-generated drafts (original, formal, concise, warm, detailed)
# ---------------------------------------------------------------------------

def generate_drafts(
    current_note: str,
    previous_notes: str = "",
    tones: list[str] | None = None,
) -> dict[str, dict]:
    """
    Generate note drafts in multiple tones. current_note is the raw user input.
    Returns dict keyed by tone: { "original": {text, confidence}, "formal": {...}, ... }.
    original = cleaned/summarized version of current_note; others = rewritten in that style.
    """
    if tones is None:
        tones = ["original", "formal", "concise", "warm", "detailed"]
    original_text = (current_note or "").strip() or "No notes provided."
    client = _get_client()
    context = ""
    if previous_notes and previous_notes.strip():
        context = "Previous communication notes (for style/context):\n" + previous_notes + "\n\n"
    prompt = f"""You are an assistant that rewrites meeting/activity notes for CRM in different tones.

{context}Current (latest) note to process:
{original_text}

Produce the following versions. For "original", provide a clean, professional one-paragraph summary of the current note (same content, polished). For the others, rewrite in that style while keeping the same factual content; "detailed" may add brief context from previous notes if relevant.

Return ONLY a JSON object with keys: original, formal, concise, warm, detailed. Each value is an object: {{"text": "...", "confidence": number 0-100}}.

- original: polished summary of current note
- formal: professional, formal language
- concise: brief, bullet-friendly
- warm: friendly, personable
- detailed: slightly more context, can reference prior history
"""
    try:
        msg = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        block = msg.content[0] if msg.content else None
        if block and getattr(block, "text", None):
            parsed = _parse_json_block(block.text)
            if isinstance(parsed, dict):
                result: dict[str, dict] = {}
                for t in tones:
                    if t == "original" and "original" not in parsed:
                        result["original"] = {"text": original_text, "confidence": 90}
                        continue
                    val = parsed.get(t)
                    if isinstance(val, dict) and "text" in val:
                        result[t] = {
                            "text": str(val["text"]).strip() or original_text,
                            "confidence": min(100, max(0, int(val.get("confidence", 75)))),
                        }
                    else:
                        result[t] = {"text": original_text, "confidence": 70}
                return result
    except Exception as e:
        logger.exception("Claude generate_drafts error: %s", e)
    return {
        "original": {"text": original_text, "confidence": 90},
        "formal": {"text": original_text, "confidence": 70},
        "concise": {"text": original_text, "confidence": 70},
        "warm": {"text": original_text, "confidence": 70},
        "detailed": {"text": original_text, "confidence": 70},
    }


def regenerate_single_draft(
    current_note: str,
    previous_notes: str,
    tone: str,
) -> dict:
    """Regenerate only one draft tone (e.g. after user clicks Regenerate for "formal")."""
    drafts = generate_drafts(current_note, previous_notes, tones=[tone])
    return drafts.get(tone, {"text": (current_note or "").strip(), "confidence": 70})
