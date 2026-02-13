"""
Aggregate v1 API routes.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import activities, contacts, dashboard, hubspot, llm

api_router = APIRouter()

api_router.include_router(hubspot.router, prefix="")
api_router.include_router(activities.router, prefix="")
api_router.include_router(contacts.router, prefix="")
api_router.include_router(dashboard.router, prefix="")
api_router.include_router(llm.router, prefix="")
