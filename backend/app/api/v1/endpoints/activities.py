"""
Activities endpoints (HubSpot tasks with cache).
List, get, create, update, delete, complete, and force-sync.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import get_current_user_id
from app.schemas.activity import (
    ActivityCreate,
    ActivityListResponse,
    ActivityResponse,
    ActivitySortOption,
    ActivityUpdate,
    CompanyInfo,
    ContactInfo,
    SyncStatusResponse,
)
from app.schemas.common import MessageResponse
from app.services.hubspot_service import HubSpotService, HubSpotServiceError, get_hubspot_service
from app.services.supabase_service import SupabaseService, get_supabase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/activities", tags=["activities"])

# Cache considered fresh if last_synced_at within this many seconds
CACHE_FRESH_SECONDS = 300  # 5 minutes

# HubSpot task property names
HS_SUBJECT = "hs_task_subject"
HS_BODY = "hs_task_body"
HS_TIMESTAMP = "hs_timestamp"
HS_STATUS = "hs_task_status"
HS_PRIORITY = "hs_task_priority"
HS_TYPE = "hs_task_type"


def _parse_ts(value: str | int | None) -> datetime | None:
    """Parse HubSpot timestamp: milliseconds since epoch or ISO 8601 string."""
    if value is None:
        return None
    try:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
            # ISO 8601 (e.g. "2026-02-11T19:00:00.000Z")
            if value[0:1].isdigit() and ("T" in value or "-" in value):
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            # Milliseconds as string
            ms = int(value)
        else:
            ms = int(value)
        return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)
    except (ValueError, TypeError):
        return None


def _hubspot_task_to_activity(task: dict[str, Any]) -> dict[str, Any]:
    """Transform a HubSpot task object to our activity format."""
    tid = task.get("id") or ""
    props = task.get("properties") or {}
    created = task.get("createdAt")
    updated = task.get("updatedAt")
    due = _parse_ts(props.get(HS_TIMESTAMP))
    status_val = (props.get(HS_STATUS) or "").upper()
    completed = status_val == "COMPLETED"
    # Contact/company IDs from associations if present
    contact_ids: list[str] = []
    company_ids: list[str] = []
    assoc = task.get("associations")
    if assoc:
        contact_ids = [a.get("id") for a in assoc.get("contacts", {}).get("results", []) if a.get("id")]
        company_ids = [a.get("id") for a in assoc.get("companies", {}).get("results", []) if a.get("id")]

    return {
        "id": tid,
        "hubspot_id": tid,
        "type": props.get(HS_TYPE) or None,
        "subject": props.get(HS_SUBJECT) or None,
        "body": props.get(HS_BODY) or None,
        "due_date": due,
        "completed": completed,
        "contact_ids": contact_ids,
        "company_ids": company_ids,
        "created_at": created,
        "updated_at": updated,
        "contacts": [],
        "companies": [],
        "_priority": props.get(HS_PRIORITY) or "",
        "_raw": task,
    }


def _apply_filters(
    activities: list[dict[str, Any]],
    date: str | None,
    relationship_status: list[str] | None,
    processing_status: list[str] | None,
    date_from: str | None,
    date_to: str | None,
) -> list[dict[str, Any]]:
    """Filter activities by query params. date is YYYY-MM-DD."""
    out = activities
    if date:
        try:
            target = datetime.strptime(date, "%Y-%m-%d").date()
            out = [
                a for a in out
                if a.get("due_date") and a["due_date"].date() == target
            ]
        except ValueError:
            pass
    if date_from:
        try:
            start = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            out = [a for a in out if a.get("due_date") and a["due_date"] >= start]
        except ValueError:
            pass
    if date_to:
        try:
            end = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            out = [a for a in out if a.get("due_date") and a["due_date"] <= end]
        except ValueError:
            pass
    if relationship_status:
        # If we had a relationship_status field we'd filter; placeholder.
        pass
    if processing_status:
        # If we had processing_status we'd filter; placeholder.
        pass
    return out


def _apply_sort(activities: list[dict[str, Any]], sort: ActivitySortOption) -> list[dict[str, Any]]:
    """Sort activities by sort option."""
    key_priority = {"HIGH": 3, "MEDIUM": 2, "LOW": 1, "": 0}

    def sort_key(a: dict[str, Any]):
        if sort == "date_newest":
            d = a.get("due_date") or a.get("created_at")
            return (d is None, -(d.timestamp() if hasattr(d, "timestamp") else 0))
        if sort == "date_oldest":
            d = a.get("due_date") or a.get("created_at")
            return (d is None, d.timestamp() if hasattr(d, "timestamp") else 0)
        if sort == "priority_high_low":
            p = key_priority.get((a.get("_priority") or "").upper(), 0)
            return (-p, (a.get("due_date") or datetime.min.replace(tzinfo=timezone.utc)).timestamp() if a.get("due_date") else 0)
        # opportunity_pct, relationship_status: stable order
        return (0, a.get("id", ""))

    return sorted(activities, key=sort_key)


def _contact_dict_to_info(
    c: dict[str, Any],
    company_name: str | None = None,
) -> ContactInfo:
    """Build ContactInfo from HubSpot contact dict (properties may be nested)."""
    props = c.get("properties") or c
    return ContactInfo(
        id=str(c.get("id", "")),
        email=props.get("email"),
        first_name=props.get("firstname"),
        last_name=props.get("lastname"),
        hubspot_id=str(c.get("id", "")),
        phone=props.get("phone"),
        mobile_phone=props.get("mobilephone"),
        company_name=company_name,
    )


def _activity_dict_to_response(a: dict[str, Any]) -> ActivityResponse:
    """Build ActivityResponse from our internal activity dict (strip _raw, _priority)."""
    company_names = a.get("contact_company_names") or {}
    contacts: list[ContactInfo] = []
    for c in a.get("contacts") or []:
        if isinstance(c, dict) and (c.get("id") or c.get("properties")):
            cid = str(c.get("id", ""))
            contacts.append(_contact_dict_to_info(c, company_name=company_names.get(cid)))
    companies: list[CompanyInfo] = []
    for c in a.get("companies") or []:
        if isinstance(c, dict) and c.get("id"):
            companies.append(CompanyInfo(
                id=c["id"],
                name=c.get("name"),
                domain=c.get("domain"),
                hubspot_id=c.get("hubspot_id"),
            ))
    return ActivityResponse(
        id=a["id"],
        hubspot_id=a.get("hubspot_id"),
        type=a.get("type"),
        subject=a.get("subject"),
        body=a.get("body"),
        due_date=a.get("due_date"),
        completed=a.get("completed", False),
        contact_ids=a.get("contact_ids", []),
        company_ids=a.get("company_ids", []),
        created_at=a.get("created_at"),
        updated_at=a.get("updated_at"),
        contacts=contacts,
        companies=companies,
    )


def _today_yyyymmdd() -> str:
    """Return today's date as YYYY-MM-DD in UTC."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@router.get(
    "/",
    response_model=ActivityListResponse,
    summary="List activities",
    description="List activities with optional filters and sort. Uses cache if fresh (5 min), else syncs from HubSpot. Default date filter is today.",
)
async def list_activities(
    user_id: str = Depends(get_current_user_id),
    date: str | None = Query(None, description="Filter by date (YYYY-MM-DD); default today"),
    relationship_status: list[str] | None = Query(None, description="Filter by relationship status"),
    processing_status: list[str] | None = Query(None, description="Filter by processing status"),
    date_from: str | None = Query(None, description="Start date for range (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="End date for range (YYYY-MM-DD)"),
    sort: ActivitySortOption = Query("date_newest", description="Sort option"),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ActivityListResponse:
    """GET /api/v1/activities/ — list activities with cache and filters. Default: tasks due today."""
    # Default date filter to today when no range specified (dashboard "today's tasks" view)
    effective_date = date
    if effective_date is None and date_from is None and date_to is None:
        effective_date = _today_yyyymmdd()

    try:
        # a) Check cache freshness
        last_synced = await supabase.get_tasks_cache_freshness(user_id)
        now = datetime.now(timezone.utc)
        fresh = False
        if last_synced:
            try:
                if last_synced.endswith("Z"):
                    synced_dt = datetime.fromisoformat(last_synced.replace("Z", "+00:00"))
                else:
                    synced_dt = datetime.fromisoformat(last_synced)
                if synced_dt.tzinfo is None:
                    synced_dt = synced_dt.replace(tzinfo=timezone.utc)
                fresh = (now - synced_dt).total_seconds() < CACHE_FRESH_SECONDS
            except (ValueError, TypeError):
                pass

        # b) If stale, fetch from HubSpot with associations and store in cache
        if not fresh:
            all_tasks: list[dict[str, Any]] = []
            after: str | None = None
            while True:
                resp = hubspot.get_tasks(
                    limit=100,
                    after=after,
                    associations=["contacts", "companies"],
                )
                results = resp.get("results") or []
                all_tasks.extend(results)
                paging = resp.get("paging") or {}
                next_p = paging.get("next") or {}
                after = next_p.get("after")
                if not after or not results:
                    break
            if all_tasks:
                await supabase.upsert_tasks_cache_bulk(user_id, all_tasks)

        # c) Read from cache and transform
        cached = await supabase.get_tasks_cache(user_id)
        activities: list[dict[str, Any]] = []
        for row in cached:
            data = row.get("data") or {}
            activities.append(_hubspot_task_to_activity(data))

        # d) Apply filters (with default today)
        activities = _apply_filters(
            activities,
            date=effective_date,
            relationship_status=relationship_status,
            processing_status=processing_status,
            date_from=date_from,
            date_to=date_to,
        )
        # e) Enrich with contact details (phone, mobile_phone, company_name) for contact_ids
        all_contact_ids = list({cid for a in activities for cid in (a.get("contact_ids") or [])})
        contact_id_to_company_name: dict[str, str] = {}
        if all_contact_ids:
            try:
                contact_list = hubspot.get_contacts_batch(
                    all_contact_ids,
                    properties=["firstname", "lastname", "email", "phone", "mobilephone"],
                )
                contact_map = {str(c.get("id", "")): c for c in contact_list if c.get("id")}
                try:
                    contact_to_company = hubspot.batch_read_contact_company_ids(all_contact_ids)
                    unique_company_ids = list(dict.fromkeys(contact_to_company.values()))
                    if unique_company_ids:
                        companies = hubspot.get_companies_batch(unique_company_ids, properties=["name"])
                        company_name_by_id = {}
                        for co in companies:
                            cid = str(co.get("id", ""))
                            props = co.get("properties") or {}
                            company_name_by_id[cid] = props.get("name")
                        for cid, co_id in contact_to_company.items():
                            contact_id_to_company_name[cid] = company_name_by_id.get(co_id) or ""
                except HubSpotServiceError:
                    pass
                for a in activities:
                    a["contacts"] = [
                        contact_map[cid] for cid in (a.get("contact_ids") or []) if cid in contact_map
                    ]
                    a["contact_company_names"] = {
                        cid: contact_id_to_company_name.get(cid, "")
                        for cid in (a.get("contact_ids") or [])
                    }
            except HubSpotServiceError:
                pass  # keep contacts empty if batch fails

        # f) Sort
        activities = _apply_sort(activities, sort)

        # g) Build response
        return ActivityListResponse(
            activities=[_activity_dict_to_response(a) for a in activities],
        )
    except HubSpotServiceError as e:
        logger.warning("HubSpot error listing activities: %s", e.message)
        # Return from cache only if HubSpot failed
        cached = await supabase.get_tasks_cache(user_id)
        activities = [_hubspot_task_to_activity(row.get("data") or {}) for row in cached]
        activities = _apply_filters(activities, effective_date, relationship_status, processing_status, date_from, date_to)
        activities = _apply_sort(activities, sort)
        return ActivityListResponse(activities=[_activity_dict_to_response(a) for a in activities])
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("List activities error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list activities",
        )


@router.post(
    "/sync",
    response_model=SyncStatusResponse,
    summary="Force sync from HubSpot",
)
async def sync_activities(
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> SyncStatusResponse:
    """POST /api/v1/activities/sync — bypass cache and sync all tasks from HubSpot."""
    try:
        all_tasks: list[dict[str, Any]] = []
        after: str | None = None
        while True:
            resp = hubspot.get_tasks(
                limit=100,
                after=after,
                associations=["contacts", "companies"],
            )
            results = resp.get("results") or []
            all_tasks.extend(results)
            paging = resp.get("paging") or {}
            after = (paging.get("next") or {}).get("after")
            if not after or not results:
                break
        if all_tasks:
            await supabase.upsert_tasks_cache_bulk(user_id, all_tasks)
        return SyncStatusResponse(
            synced=True,
            message="Sync completed successfully",
            tasks_count=len(all_tasks),
        )
    except HubSpotServiceError as e:
        logger.warning("HubSpot sync error: %s", e.message)
        return SyncStatusResponse(
            synced=False,
            message=e.message or "HubSpot error during sync",
            tasks_count=0,
        )
    except Exception as e:
        logger.exception("Sync activities error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync activities",
        )


@router.get(
    "/{activity_id}",
    response_model=ActivityResponse,
    summary="Get single activity",
)
async def get_activity(
    activity_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ActivityResponse:
    """GET /api/v1/activities/{activity_id} — fetch from cache or HubSpot. Returns task with contact summary and notes (communication history)."""
    try:
        cached = await supabase.get_tasks_cache(user_id)
        for row in cached:
            if (row.get("hubspot_task_id") or row.get("data", {}).get("id")) == activity_id:
                data = row.get("data") or {}
                a = _hubspot_task_to_activity(data)
                # Enrich with contact details for contact summary
                contact_ids = a.get("contact_ids") or []
                if contact_ids:
                    try:
                        contact_list = hubspot.get_contacts_batch(contact_ids)
                        a["contacts"] = contact_list
                    except HubSpotServiceError:
                        pass
                return _activity_dict_to_response(a)
        # Not in cache: fetch from HubSpot with associations
        task = hubspot.get_task(activity_id, associations=["contacts", "companies"])
        await supabase.upsert_task_cache(user_id, activity_id, task)
        a = _hubspot_task_to_activity(task)
        contact_ids = a.get("contact_ids") or []
        if contact_ids:
            try:
                a["contacts"] = hubspot.get_contacts_batch(contact_ids)
            except HubSpotServiceError:
                pass
        return _activity_dict_to_response(a)
    except HubSpotServiceError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot error",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get activity error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get activity",
        )


@router.post(
    "/",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create activity",
)
async def create_activity(
    body: ActivityCreate,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ActivityResponse:
    """POST /api/v1/activities/ — create in HubSpot and cache."""
    try:
        props: dict[str, Any] = {}
        if body.subject is not None:
            props[HS_SUBJECT] = body.subject
        if body.body is not None:
            props[HS_BODY] = body.body
        if body.due_date is not None:
            props[HS_TIMESTAMP] = int(body.due_date.timestamp() * 1000)
        if body.completed is not None:
            props[HS_STATUS] = "COMPLETED" if body.completed else "NOT_STARTED"
        if body.type is not None:
            props[HS_TYPE] = body.type
        payload = {"properties": props}
        task = hubspot.create_task(payload)
        tid = task.get("id")
        if not tid:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="HubSpot did not return task id")
        await supabase.upsert_task_cache(user_id, str(tid), task)
        a = _hubspot_task_to_activity(task)
        return _activity_dict_to_response(a)
    except HubSpotServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot error",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Create activity error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create activity",
        )


@router.put(
    "/{activity_id}",
    response_model=ActivityResponse,
    summary="Update activity",
)
async def update_activity(
    activity_id: str,
    body: ActivityUpdate,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> ActivityResponse:
    """PUT /api/v1/activities/{activity_id} — update in HubSpot and cache."""
    try:
        props: dict[str, Any] = {}
        if body.subject is not None:
            props[HS_SUBJECT] = body.subject
        if body.body is not None:
            props[HS_BODY] = body.body
        if body.due_date is not None:
            props[HS_TIMESTAMP] = int(body.due_date.timestamp() * 1000)
        if body.completed is not None:
            props[HS_STATUS] = "COMPLETED" if body.completed else "NOT_STARTED"
        if body.type is not None:
            props[HS_TYPE] = body.type
        payload = {"properties": props}
        if not payload.get("properties"):
            # Fetch current and merge or return as-is
            task = hubspot.get_task(activity_id)
            await supabase.upsert_task_cache(user_id, activity_id, task)
            return _activity_dict_to_response(_hubspot_task_to_activity(task))
        task = hubspot.update_task(activity_id, payload)
        await supabase.upsert_task_cache(user_id, activity_id, task)
        return _activity_dict_to_response(_hubspot_task_to_activity(task))
    except HubSpotServiceError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot error",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Update activity error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update activity",
        )


@router.delete(
    "/{activity_id}",
    response_model=MessageResponse,
    summary="Delete activity",
)
async def delete_activity(
    activity_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> MessageResponse:
    """DELETE /api/v1/activities/{activity_id} — delete in HubSpot and remove from cache."""
    try:
        hubspot.delete_task(activity_id)
    except HubSpotServiceError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot error",
        )
    await supabase.delete_task_cache(user_id, activity_id)
    return MessageResponse(message="Activity deleted successfully")


@router.post(
    "/{activity_id}/complete",
    response_model=MessageResponse,
    summary="Mark activity complete",
)
async def complete_activity(
    activity_id: str,
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
    hubspot: HubSpotService = Depends(get_hubspot_service),
) -> MessageResponse:
    """POST /api/v1/activities/{activity_id}/complete — set status to COMPLETED in HubSpot."""
    try:
        payload = {"properties": {HS_STATUS: "COMPLETED"}}
        task = hubspot.update_task(activity_id, payload)
        await supabase.upsert_task_cache(user_id, activity_id, task)
        return MessageResponse(message="Activity marked complete")
    except HubSpotServiceError as e:
        if e.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=e.message or "HubSpot error",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Complete activity error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete activity",
        )
