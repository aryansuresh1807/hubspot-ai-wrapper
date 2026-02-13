"""
HubSpot AI Wrapper - FastAPI application.
CORS, API versioning (/api/v1), health check, error handling.
"""

import logging
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from app.api.v1.endpoints import auth
from app.api.v1.routes import api_router
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Load settings once at import so CORS list is available to middleware
_settings = get_settings()


class PreflightCorsMiddleware(BaseHTTPMiddleware):
    """
    Respond to OPTIONS (preflight) immediately with 200 and CORS headers.
    Some proxies (e.g. Railway) can 502 on OPTIONS if the app doesn't respond fast enough;
    this ensures preflight is handled before any other middleware or routing.
    """

    async def dispatch(self, request: StarletteRequest, call_next: Callable) -> Response:
        if request.method != "OPTIONS":
            return await call_next(request)
        origin = request.headers.get("origin", "").strip()
        allowed = _settings.cors_origins_list
        allow_origin = origin if origin in allowed else (allowed[0] if allowed else "*")
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": allow_origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400",
            },
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("Starting HubSpot AI Wrapper API")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="HubSpot AI Wrapper API",
    version="1.0.0",
    description="Backend API: HubSpot integration, LLM processing, Supabase.",
    lifespan=lifespan,
)

# CORS: preflight first (runs first), then general CORS for all responses
app.add_middleware(PreflightCorsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Auth routes
app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["Authentication"],
)


# Error handling middleware
@app.middleware("http")
async def catch_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )


# Root and health (outside versioning)
@app.get("/")
def root():
    return {
        "message": "HubSpot AI Wrapper API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "auth": "/api/v1/auth",
            "contacts": "/api/v1/contacts",
            "activities": "/api/v1/activities",
            "dashboard": "/api/v1/dashboard",
            "hubspot": "/api/v1/hubspot",
            "llm": "/api/v1/llm",
        },
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


# API v1
app.include_router(api_router, prefix="/api/v1")
