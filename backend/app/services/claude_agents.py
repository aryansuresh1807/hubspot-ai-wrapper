"""
Claude LLM agents for activity note processing.
Uses ANTHROPIC_API_KEY; all agents return structured data for the activity page.
"""

import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from anthropic import Anthropic
import requests

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Domains we treat as consumer/personal email (not company); contact domain won't be used for company confirmation.
CONSUMER_EMAIL_DOMAINS = frozenset({
    "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "outlook.com", "hotmail.com",
    "hotmail.co.uk", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com",
    "protonmail.com", "proton.me", "zoho.com", "mail.com", "yandex.com", "gmx.com", "gmx.net",
})

# Default model for all agents
DEFAULT_MODEL = "claude-sonnet-4-20250514"
DEFAULT_MAX_TOKENS = 2048


def _get_client() -> Anthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY is not set")
    return Anthropic(api_key=settings.anthropic_api_key)


def _get_first_text_from_message(msg) -> str | None:
    """Safely get the first text block from an Anthropic message. Returns None if empty or no text block."""
    content = getattr(msg, "content", None)
    if not content:
        return None
    for block in content:
        text = getattr(block, "text", None)
        if text is not None and isinstance(text, str) and text.strip():
            return text
    return None


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
# 1. Summary of communication history (legacy: returns plain text)
# ---------------------------------------------------------------------------

def summarize_communication_history(full_notes: str) -> str:
    """
    Produce a short summary of the full notes history for this contact.
    Used for the "Summary of Communication History" section (view only).
    """
    result = generate_communication_summary(full_notes)
    return result.get("summary") or "No communication history yet."


# ---------------------------------------------------------------------------
# 1b. Communication summary agent (summary + times contacted + relationship status)
# ---------------------------------------------------------------------------

def generate_communication_summary(full_notes: str) -> dict:
    """
    Analyse client notes and return structured communication summary:
    - summary: concise summary of the notes
    - times_contacted: what can be recognised from the notes (e.g. "3 calls, 2 emails in Jan 2025")
    - relationship_status: relationship status inferred from the notes (e.g. "Warm", "Prospect", "Customer")
    Used for the Communication Summary section on the activity page; stored per task in Supabase.
    """
    logger.info("[generate_communication_summary] entry full_notes_len=%s", len(full_notes or ""))
    if not full_notes or not full_notes.strip():
        logger.info("[generate_communication_summary] empty notes, returning default")
        return {
            "summary": "No communication history yet.",
            "times_contacted": "",
            "relationship_status": "",
        }
    prompt = """You are an assistant that analyses client communication notes for a sales/relationship manager.

Given the full notes history below (often with date-prefixed entries), produce a structured analysis.

Respond with ONLY a JSON object in this exact format, no other text:
{
  "summary": "2-4 short paragraphs: key topics, outcomes, commitments, next steps, and relationship context.",
  "times_contacted": "What you can recognise from the notes about how often or when they were contacted (e.g. '3 calls in January, 2 emails in February', or 'Initial call 01/15, follow-up 01/22'). If unclear, say 'Not clearly stated' or similar.",
  "relationship_status": "One short phrase for the relationship status as it appears from the notes (e.g. 'Prospect', 'Warm lead', 'Existing customer', 'Churned'). If unclear, use 'Unknown'."
}

Notes:
"""
    # Truncate notes to avoid token/size limits and API errors
    max_notes_len = 50_000
    notes_to_send = (full_notes[:max_notes_len] + "...") if len(full_notes) > max_notes_len else full_notes
    content_len = len(prompt) + len(notes_to_send)
    logger.info("[generate_communication_summary] notes_to_send_len=%s total_content_len=%s", len(notes_to_send), content_len)
    try:
        client = _get_client()
        logger.info("[generate_communication_summary] calling Claude API model=%s", DEFAULT_MODEL)
        msg = client.messages.create(
            model=DEFAULT_MODEL,
            max_tokens=DEFAULT_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt + notes_to_send}],
        )
        content_blocks = getattr(msg, "content", None) or []
        logger.info("[generate_communication_summary] response received content_blocks=%s", len(content_blocks))
        text = _get_first_text_from_message(msg)
        if text:
            logger.info("[generate_communication_summary] first text block len=%s preview=%s", len(text), (text[:200] + "..." if len(text) > 200 else text))
            parsed = _parse_json_block(text)
            if isinstance(parsed, dict):
                logger.info("[generate_communication_summary] parsed JSON ok keys=%s", list(parsed.keys()) if parsed else None)
                return {
                    "summary": (parsed.get("summary") or "").strip() or "No summary generated.",
                    "times_contacted": (parsed.get("times_contacted") or "").strip(),
                    "relationship_status": (parsed.get("relationship_status") or "").strip(),
                }
            logger.warning("[generate_communication_summary] parsed result not a dict: type=%s", type(parsed).__name__)
        else:
            logger.warning("[generate_communication_summary] no text in response (blocks=%s)", len(content_blocks))
    except ValueError as e:
        logger.warning("[generate_communication_summary] config error: %s", e)
        return {
            "summary": "Unable to generate summary. Please try again.",
            "times_contacted": "",
            "relationship_status": "",
        }
    except Exception as e:
        logger.exception(
            "[generate_communication_summary] exception type=%s msg=%s",
            type(e).__name__,
            str(e),
        )
        return {
            "summary": "Unable to generate summary. Please try again.",
            "times_contacted": "",
            "relationship_status": "",
        }
    logger.info("[generate_communication_summary] falling through to no-summary (no text or parse failed)")
    return {
        "summary": "No summary generated.",
        "times_contacted": "",
        "relationship_status": "",
    }


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


# ---------------------------------------------------------------------------
# 6. Extract contact + company from email (for "Import from communication")
# ---------------------------------------------------------------------------

def _domain_from_email(email: str) -> str:
    """Extract domain from an email address (e.g. contact@company.com -> company.com)."""
    if not email or "@" not in email:
        return ""
    return email.strip().rsplit("@", 1)[-1].lower()


def _is_consumer_email_domain(domain: str) -> bool:
    """True if the domain is a known consumer/personal email provider."""
    return (domain or "").lower() in CONSUMER_EMAIL_DOMAINS


def _company_name_from_domain(domain: str, timeout_sec: float = 4.0) -> Optional[str]:
    """
    Try to get a company name from the domain's homepage (e.g. fetch and parse <title>).
    Returns None on any failure or if title is not usable.
    """
    if not domain or "." not in domain:
        return None
    domain = domain.lower().strip()
    if domain.startswith("www."):
        domain = domain[4:]
    url = f"https://{domain}"
    try:
        resp = requests.get(url, timeout=timeout_sec, allow_redirects=True)
        resp.raise_for_status()
        text = (resp.text or "")[:100000]
        match = re.search(r"<title[^>]*>\s*([^<]+?)\s*</title>", text, re.IGNORECASE | re.DOTALL)
        if not match:
            return None
        title = match.group(1).strip()
        title = re.sub(r"\s+", " ", title)
        # Drop common suffixes that are not the company name
        for suffix in (" - home", " | home", " - official site", " - welcome", " | official site"):
            if title.lower().endswith(suffix):
                title = title[: -len(suffix)].strip()
        if len(title) < 2 or len(title) > 120:
            return None
        return title
    except Exception as e:
        logger.debug("Could not fetch title for domain %s: %s", domain, e)
        return None


def _normalize_company_for_compare(name: str) -> str:
    """Normalize company name for similarity (lowercase, remove common suffixes)."""
    if not name:
        return ""
    s = name.strip().lower()
    for suffix in (" inc", " inc.", " corp", " corp.", " ltd", " ltd.", " llc", " co.", " company"):
        if s.endswith(suffix):
            s = s[: -len(suffix)].strip()
    return re.sub(r"[^a-z0-9]", "", s)


def _confirm_company_from_contact_domain(result: dict) -> dict:
    """
    Use the contact's email domain to confirm or fill company_name and company_domain.
    If the contact email has a non-consumer domain (e.g. contact@company.com), use that domain
    as company_domain and optionally resolve company name from the domain (e.g. fetch homepage title).
    Reconcile with company name from the email body using internal confidence; frontend sees only
    the chosen company_name and company_domain.
    """
    contact_email = (result.get("email") or "").strip()
    if not contact_email or "@" not in contact_email:
        return result
    domain = _domain_from_email(contact_email)
    if not domain or _is_consumer_email_domain(domain):
        return result
    # Work-domain: use it for company_domain at least
    body_company = (result.get("company_name") or "").strip()
    body_domain = (result.get("company_domain") or "").strip().lower()
    # Ensure company_domain is set to contact's domain (we're confident it's work)
    result = {**result, "company_domain": result.get("company_domain") or domain}
    if body_domain and body_domain != domain:
        result["company_domain"] = domain  # Prefer contact domain for consistency
    # Try to get company name from domain (e.g. homepage title)
    domain_company = _company_name_from_domain(domain)
    if not domain_company:
        # Keep body company if any; domain is already set
        return result
    if not body_company:
        result["company_name"] = domain_company
        return result
    # Both present: reconcile by confidence (internal)
    norm_body = _normalize_company_for_compare(body_company)
    norm_domain = _normalize_company_for_compare(domain_company)
    if norm_body and norm_domain and (norm_body in norm_domain or norm_domain in norm_body or norm_body[:8] == norm_domain[:8]):
        # High confidence they refer to same company: keep body name (usually more formal)
        return result
    # Different: prefer body name if it looks formal (Inc/Corp etc.), else prefer domain title
    if re.search(r"\b(inc|corp|ltd|llc|co\.?)\b", body_company, re.I):
        return result
    result["company_name"] = domain_company
    return result


def _extract_email_address(header: str) -> str:
    """Extract a single email address from a header like 'Name <addr@domain.com>' or plain 'addr@domain.com'."""
    if not header or "@" not in header:
        return ""
    s = header.strip()
    if "<" in s and ">" in s:
        m = re.search(r"<([^>]+)>", s)
        return m.group(1).strip() if m else ""
    return s


def _contact_email_from_direction(sender: str, to: str, user_email: str) -> str:
    """
    Determine contact email from message direction when we know the current user's email.
    - Inbox email (user received): contact = sender → return From address.
    - Sent email (user sent): contact = receiver → return first To address (that is not the user).
    """
    u = user_email.strip().lower()
    from_addr = _extract_email_address(sender or "")
    if not from_addr:
        return ""
    # To can be multiple: "A <a@x.com>, B <b@y.com>" or "a@x.com, b@y.com"
    to_raw = (to or "").strip()
    if not to_raw:
        to_addresses = []
    else:
        to_addresses = []
        for part in re.split(r",\s*", to_raw):
            addr = _extract_email_address(part)
            if addr:
                to_addresses.append(addr)
    # User sent (From == user) → contact is recipient → use first To address
    if from_addr.lower() == u:
        for addr in to_addresses:
            if addr.lower() != u:
                return addr
        return to_addresses[0] if to_addresses else ""
    # User received (user is in To) → contact is sender → use From address
    if any(addr.lower() == u for addr in to_addresses) or (to_addresses and to_addresses[0].lower() == u):
        return from_addr
    # To might be a single string without comma; try parsing whole To as one
    single_to = _extract_email_address(to_raw)
    if single_to.lower() == u:
        return from_addr
    return ""


def extract_contact_from_email(
    sender: str,
    to: str,
    subject: str,
    body: str,
    user_email: str | None = None,
) -> dict:
    """
    Analyse email (sender, to, subject, body) and return structured contact and company fields
    for populating the contact form and optional company creation.
    user_email: the connected Gmail address of the current user; used to determine which party
    is "the contact" (the other party). If From == user_email, contact is the recipient (To).
    If To == user_email, contact is the sender (From).
    Returns dict with: first_name, last_name, email, phone, job_title, company_name,
    company_domain, city, state_region, company_owner. Empty string for missing fields.
    """
    empty = {
        "first_name": "",
        "last_name": "",
        "email": "",
        "phone": "",
        "job_title": "",
        "company_name": "",
        "company_domain": "",
        "city": "",
        "state_region": "",
        "company_owner": "",
    }
    combined = (sender or "") + (to or "") + (subject or "") + (body or "")
    if not combined.strip():
        return empty
    client = _get_client()

    user_email_instruction = ""
    if user_email and user_email.strip():
        u = user_email.strip().lower()
        user_email_instruction = (
            f"\n**Current user's email (the person using this tool):** {user_email.strip()}\n"
            "The CONTACT to extract is always the *other* party, not the user.\n"
            "- If the email was SENT by the user (From matches the user's email): the contact is the RECIPIENT. Set contact email from the To field (extract the address only, e.g. from 'Name <a@b.com>' use 'a@b.com').\n"
            "- If the email was RECEIVED by the user (To contains the user's email): the contact is the SENDER. Set contact email from the From field (extract the address only).\n"
        )

    prompt = """You are a CRM contact extraction agent. Your job is to extract structured contact and company information from a single email so it can be used to create or update a contact in HubSpot. Be thorough, consistent, and accurate.

**Rules**
1. Extract the MAIN contact (one person) and their organization. The contact is the person we want to add to the CRM.
2. For every field, extract the most specific value you can find. Use empty string "" only when you truly cannot determine a value.
3. Output ONLY valid JSON in the exact format below. No markdown code fences, no explanation, no other text.
""" + user_email_instruction + """
**Field definitions**
- **first_name, last_name:** The contact's given name and family name. Extract from salutations (e.g. "Dear John Smith" → first_name: "John", last_name: "Smith"), from signature (e.g. "Regards, Aryan" → if that is the contact), or from the contact's email display name. Split correctly; if only one name is given, put it in first_name and leave last_name "".
- **email:** The contact's email address only (e.g. "john@company.com"). Use the rule above: if the user sent the email, contact email = To; if the user received it, contact email = From. Extract just the address from formats like "Name <email@domain.com>".
- **phone:** Any phone number clearly associated with the contact. Digits only or E.164 if obvious; otherwise "".
- **job_title:** Job title if stated (e.g. "VP of Sales"); otherwise "".
- **company_name:** The company or organization the contact works for or is associated with. Look for: "your company X", "company X", "at X", "with X", "X Inc", "X Corp", "X Ltd", or the most prominent organization name in the body. Capitalize properly (e.g. "Facebook", not "facebook").
- **company_domain:** The most likely official website domain for that company. Infer from the company name: e.g. "Facebook" → "facebook.com", "Microsoft" → "microsoft.com", "Acme Corp" → "acme.com". Use lowercase, no "www". Only leave "" if company_name is unknown or highly ambiguous.
- **city, state_region:** Location if mentioned; otherwise "".
- **company_owner:** Name or identifier of an owner/decision-maker at the company if mentioned; otherwise "".

**Output format (JSON only):**
{"first_name": "", "last_name": "", "email": "", "phone": "", "job_title": "", "company_name": "", "company_domain": "", "city": "", "state_region": "", "company_owner": ""}

---
**Email to analyse:**

From: """ + (sender or "") + """
To: """ + (to or "") + """
Subject: """ + (subject or "") + """

Body:
""" + (body or "")[:14000]

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
                def s(v): return (v or "").strip() if v is not None else ""
                email_val = s(parsed.get("email"))
                # Normalize: extract address from "Display Name <addr@domain.com>"
                if email_val and "<" in email_val and ">" in email_val:
                    email_val = _extract_email_address(email_val)
                # Backend rule: when we know user_email, contact email is determined by direction.
                # Inbox (user received) → contact = sender → use From.
                # Sent (user sent) → contact = receiver → use To.
                if user_email and user_email.strip():
                    derived = _contact_email_from_direction(sender or "", to or "", user_email)
                    if derived:
                        email_val = derived
                result = {
                    "first_name": s(parsed.get("first_name")),
                    "last_name": s(parsed.get("last_name")),
                    "email": email_val,
                    "phone": s(parsed.get("phone")),
                    "job_title": s(parsed.get("job_title")),
                    "company_name": s(parsed.get("company_name")),
                    "company_domain": s(parsed.get("company_domain")),
                    "city": s(parsed.get("city")),
                    "state_region": s(parsed.get("state_region")),
                    "company_owner": s(parsed.get("company_owner")),
                }
                result = _confirm_company_from_contact_domain(result)
                return result
    except Exception as e:
        logger.exception("Claude extract_contact_from_email error: %s", e)
    return {
        "first_name": "",
        "last_name": "",
        "email": "",
        "phone": "",
        "job_title": "",
        "company_name": "",
        "company_domain": "",
        "city": "",
        "state_region": "",
        "company_owner": "",
    }
