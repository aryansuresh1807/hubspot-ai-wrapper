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
HS_MOBILEPHONE = "mobilephone"
HS_JOBTITLE = "jobtitle"


def _hubspot_contact_to_contact(hc: dict[str, Any], company_name: str | None = None) -> Contact:
    """Transform HubSpot contact object to our Contact schema."""
    cid = hc.get("id") or ""
    props = hc.get("properties") or {}
    return Contact(
        id=cid,
        hubspot_id=cid,
        email=props.get(HS_EMAIL),
        first_name=props.get(HS_FIRSTNAME),
        last_name=props.get(HS_LASTNAME),
        company_id=None,
        company_name=company_name,
        phone=props.get(HS_PHONE),
        mobile_phone=props.get(HS_MOBILEPHONE),
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
    summary="Unified contact search",
    description="Search by contact name/email or company name. Returns matching contacts with company_name when from company search.",
)
async def search_contacts(
    q: str = Query(..., min_length=1, description="Search query (contact name, email, or company name)"),
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ContactListResponse:
    """GET /api/v1/contacts/search?q= — search contacts by name/email and by company name; merge and dedupe."""
    try:
        q_trim = q.strip()
        seen: set[str] = set()
        out_contacts: list[Contact] = []

        # 1) Contact search (name, email, phone, etc.)
        try:
            cr = hubspot.search_contacts(query=q_trim, limit=100)
            c_results = cr.get("results") or []
            for hc in c_results:
                cid = hc.get("id") or ""
                if cid and cid not in seen:
                    seen.add(cid)
                    out_contacts.append(_hubspot_contact_to_contact(hc))
            if c_results:
                await supabase.upsert_contacts_cache_bulk(user_id, c_results)
        except HubSpotServiceError as ce:
            logger.warning("HubSpot contact search error: %s", ce.message)

        # 2) Company search -> associated contacts (with company_name)
        try:
            co_result = hubspot.search_companies(query=q_trim, limit=20)
            companies = co_result.get("results") or []
            # company id -> name
            company_names: dict[str, str] = {}
            contact_ids_by_company: list[tuple[str, str]] = []  # (contact_id, company_name)
            for co in companies:
                coid = co.get("id")
                if not coid:
                    continue
                coid = str(coid)
                props = co.get("properties") or {}
                cname = props.get("name") or coid
                company_names[coid] = cname
                try:
                    cids = hubspot.get_company_contact_ids(coid)
                    for cid in cids:
                        if cid not in seen:
                            seen.add(cid)
                            contact_ids_by_company.append((cid, cname))
                except HubSpotServiceError as ae:
                    logger.debug("Associations for company %s: %s", coid, ae.message)

            if contact_ids_by_company:
                ids_to_fetch = [cid for cid, _ in contact_ids_by_company]
                batch = hubspot.get_contacts_batch(
                    ids_to_fetch[:100],
                    properties=["firstname", "lastname", "email", "phone", "mobilephone", "jobtitle", "relationship_status", "notes"],
                )
                name_by_id = {cid: cname for cid, cname in contact_ids_by_company}
                for hc in batch:
                    cid = str(hc.get("id") or "")
                    if not cid:
                        continue
                    cname = name_by_id.get(cid)
                    out_contacts.append(_hubspot_contact_to_contact(hc, company_name=cname))
                if batch:
                    await supabase.upsert_contacts_cache_bulk(user_id, batch)
        except HubSpotServiceError as ce:
            logger.warning("HubSpot company search error: %s", ce.message)

        return ContactListResponse(contacts=out_contacts)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unified search error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search contacts",
        )


CONTACT_DETAIL_PROPERTIES = [
    "firstname",
    "lastname",
    "email",
    "phone",
    "mobilephone",
    "jobtitle",
    "relationship_status",
    "notes",
]


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
    """GET /api/v1/contacts/{contact_id} — fetch single contact with company name and mobile phone."""
    try:
        contact_data = hubspot.get_contact(
            contact_id,
            properties=CONTACT_DETAIL_PROPERTIES,
        )
        await supabase.upsert_contact_cache(user_id, contact_id, contact_data)

        company_name: str | None = None
        try:
            company_ids = hubspot.get_contact_company_ids(contact_id)
            if company_ids:
                company_data = hubspot.get_company(
                    company_ids[0],
                    properties=["name"],
                )
                props = company_data.get("properties") or {}
                company_name = props.get("name")
        except HubSpotServiceError as ce:
            logger.debug("Contact company lookup for %s: %s", contact_id, ce.message)

        return _hubspot_contact_to_contact(contact_data, company_name=company_name)
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
