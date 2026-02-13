"""
Contacts endpoints (HubSpot contacts with cache).
List, get, create, update, delete, and search.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user_id
from app.schemas.contact import (
    Contact,
    ContactCreate,
    ContactDetailResponse,
    ContactListResponse,
    ContactUpdate,
)
from app.schemas.common import MessageResponse
from app.services.hubspot_service import HubSpotService, HubSpotServiceError, get_hubspot_service
from app.services.supabase_service import SupabaseService, get_supabase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contacts", tags=["contacts"])

# HubSpot contact property names
HS_FIRSTNAME = "firstname"
HS_LASTNAME = "lastname"
HS_EMAIL = "email"
HS_PHONE = "phone"
HS_JOBTITLE = "jobtitle"


def _hubspot_contact_to_contact(hc: dict[str, Any]) -> Contact:
    """Transform HubSpot contact object to our Contact schema."""
    cid = hc.get("id") or ""
    props = hc.get("properties") or {}
    return Contact(
        id=cid,
        hubspot_id=cid,
        email=props.get(HS_EMAIL),
        first_name=props.get(HS_FIRSTNAME),
        last_name=props.get(HS_LASTNAME),
        company_id=None,  # Would need associations to resolve
        phone=props.get(HS_PHONE),
        job_title=props.get(HS_JOBTITLE),
        relationship_status=props.get("relationship_status"),
        notes=props.get("notes"),
        created_at=hc.get("createdAt"),
        updated_at=hc.get("updatedAt"),
    )


def _contact_create_to_hubspot_properties(body: ContactCreate) -> dict[str, Any]:
    """Build HubSpot properties dict from ContactCreate."""
    props: dict[str, Any] = {
        HS_FIRSTNAME: body.first_name,
        HS_LASTNAME: body.last_name,
        HS_EMAIL: body.email,
    }
    if body.phone is not None:
        props[HS_PHONE] = body.phone
    if body.job_title is not None:
        props[HS_JOBTITLE] = body.job_title
    if body.relationship_status is not None:
        props["relationship_status"] = body.relationship_status
    if body.notes is not None:
        props["notes"] = body.notes
    return props


def _contact_update_to_hubspot_properties(body: ContactUpdate) -> dict[str, Any]:
    """Build HubSpot properties dict from ContactUpdate (only set provided fields)."""
    props: dict[str, Any] = {}
    if body.first_name is not None:
        props[HS_FIRSTNAME] = body.first_name
    if body.last_name is not None:
        props[HS_LASTNAME] = body.last_name
    if body.email is not None:
        props[HS_EMAIL] = body.email
    if body.phone is not None:
        props[HS_PHONE] = body.phone
    if body.job_title is not None:
        props[HS_JOBTITLE] = body.job_title
    if body.relationship_status is not None:
        props["relationship_status"] = body.relationship_status
    if body.notes is not None:
        props["notes"] = body.notes
    return props


@router.get(
    "/",
    response_model=ContactListResponse,
    summary="List contacts",
    description="Fetch contacts from HubSpot, cache in hubspot_contacts_cache, return list.",
)
async def list_contacts(
    search: str | None = Query(None, description="Optional search filter (filter applied after fetch)"),
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ContactListResponse:
    """GET /api/v1/contacts/ — fetch from HubSpot, cache, optionally filter by search."""
    try:
        all_contacts: list[dict[str, Any]] = []
        after: str | None = None
        while True:
            resp = hubspot.get_contacts(limit=100, after=after)
            results = resp.get("results") or []
            all_contacts.extend(results)
            paging = resp.get("paging") or {}
            after = (paging.get("next") or {}).get("after")
            if not after or not results:
                break
        if all_contacts:
            await supabase.upsert_contacts_cache_bulk(user_id, all_contacts)
        contacts = [_hubspot_contact_to_contact(c) for c in all_contacts]
        if search and search.strip():
            q = search.strip().lower()
            contacts = [
                c for c in contacts
                if (c.email and q in c.email.lower())
                or (c.first_name and q in c.first_name.lower())
                or (c.last_name and q in c.last_name.lower())
                or (c.first_name and c.last_name and q in f"{c.first_name} {c.last_name}".lower())
                or (c.last_name and c.first_name and q in f"{c.last_name} {c.first_name}".lower())
            ]
        return ContactListResponse(contacts=contacts)
    except HubSpotServiceError as e:
        logger.warning("HubSpot error listing contacts: %s", e.message)
        cached = await supabase.get_contacts_cache(user_id)
        contacts = [_hubspot_contact_to_contact(row.get("data") or {}) for row in cached]
        if search and search.strip():
            q = search.strip().lower()
            contacts = [
                c for c in contacts
                if (c.email and q in c.email.lower())
                or (c.first_name and q in c.first_name.lower())
                or (c.last_name and q in c.last_name.lower())
            ]
        return ContactListResponse(contacts=contacts)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("List contacts error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list contacts",
        )


@router.get(
    "/search",
    response_model=ContactListResponse,
    summary="Search contacts",
    description="Search contacts by name or email via HubSpot search API.",
)
async def search_contacts(
    q: str = Query(..., min_length=1, description="Search query (name or email)"),
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ContactListResponse:
    """GET /api/v1/contacts/search?q= — search by name/email, return matching contacts."""
    try:
        result = hubspot.search_contacts(query=q, limit=100)
        results = result.get("results") or []
        contacts = [_hubspot_contact_to_contact(c) for c in results]
        if results:
            await supabase.upsert_contacts_cache_bulk(user_id, results)
        return ContactListResponse(contacts=contacts)
    except HubSpotServiceError as e:
        logger.warning("HubSpot search error: %s", e.message)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot search failed",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Search contacts error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search contacts",
        )


@router.get(
    "/{contact_id}",
    response_model=ContactDetailResponse,
    summary="Get contact",
)
async def get_contact(
    contact_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ContactDetailResponse:
    """GET /api/v1/contacts/{contact_id} — fetch single contact from cache or HubSpot."""
    try:
        cached = await supabase.get_contacts_cache(user_id)
        for row in cached:
            if (row.get("hubspot_contact_id") or (row.get("data") or {}).get("id")) == contact_id:
                data = row.get("data") or {}
                return _hubspot_contact_to_contact(data)
        contact_data = hubspot.get_contact(contact_id)
        await supabase.upsert_contact_cache(user_id, contact_id, contact_data)
        return _hubspot_contact_to_contact(contact_data)
    except HubSpotServiceError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot error",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get contact error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get contact",
        )


@router.post(
    "/",
    response_model=ContactDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create contact",
)
async def create_contact(
    body: ContactCreate,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ContactDetailResponse:
    """POST /api/v1/contacts/ — create in HubSpot and cache."""
    try:
        props = _contact_create_to_hubspot_properties(body)
        payload = {"properties": props}
        contact_data = hubspot.create_contact(payload)
        cid = contact_data.get("id")
        if not cid:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="HubSpot did not return contact id")
        await supabase.upsert_contact_cache(user_id, str(cid), contact_data)
        return _hubspot_contact_to_contact(contact_data)
    except HubSpotServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot error",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create contact error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create contact",
        )


@router.put(
    "/{contact_id}",
    response_model=ContactDetailResponse,
    summary="Update contact",
)
async def update_contact(
    contact_id: str,
    body: ContactUpdate,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ContactDetailResponse:
    """PUT /api/v1/contacts/{contact_id} — update in HubSpot and cache."""
    try:
        props = _contact_update_to_hubspot_properties(body)
        if not props:
            contact_data = hubspot.get_contact(contact_id)
            await supabase.upsert_contact_cache(user_id, contact_id, contact_data)
            return _hubspot_contact_to_contact(contact_data)
        payload = {"properties": props}
        contact_data = hubspot.update_contact(contact_id, payload)
        await supabase.upsert_contact_cache(user_id, contact_id, contact_data)
        return _hubspot_contact_to_contact(contact_data)
    except HubSpotServiceError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot error",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Update contact error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update contact",
        )


@router.delete(
    "/{contact_id}",
    response_model=MessageResponse,
    summary="Delete contact",
)
async def delete_contact(
    contact_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> MessageResponse:
    """DELETE /api/v1/contacts/{contact_id} — delete in HubSpot and remove from cache."""
    try:
        hubspot.delete_contact(contact_id)
    except HubSpotServiceError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot error",
        )
    await supabase.delete_contact_cache(user_id, contact_id)
    return MessageResponse(message="Contact deleted successfully")
