"""
Auth API: signup, signin, signout, me, password reset/update.
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user, get_current_user_id
from app.schemas.auth import (
    AuthResponse,
    MessageResponse,
    PasswordResetRequest,
    PasswordUpdateRequest,
    SignInRequest,
    SignUpRequest,
    UserProfile,
)
from app.services.supabase_service import SupabaseService, get_supabase_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def signup(
    request: SignUpRequest,
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Register a new user.

    - **email**: Valid email address
    - **password**: Minimum 8 characters
    - **full_name**: User's full name
    """
    result = await supabase.sign_up(
        email=request.email,
        password=request.password,
        full_name=request.full_name,
    )

    session = result["session"]
    user = result["user"]

    # Get user profile
    profile = await supabase.get_user_profile(user.id)

    return AuthResponse(
        access_token=session.access_token,
        token_type="bearer",
        expires_in=session.expires_in,
        expires_at=session.expires_at,
        refresh_token=session.refresh_token,
        user=UserProfile(
            id=user.id,
            email=user.email,
            full_name=profile.get("full_name") if profile else None,
            company_name=profile.get("company_name") if profile else None,
            hubspot_portal_id=profile.get("hubspot_portal_id") if profile else None,
            created_at=user.created_at,
        ),
    )


@router.post("/signin", response_model=AuthResponse)
async def signin(
    request: SignInRequest,
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Sign in an existing user.

    - **email**: Registered email address
    - **password**: User's password
    """
    result = await supabase.sign_in(
        email=request.email,
        password=request.password,
    )

    session = result["session"]
    user = result["user"]

    # Get user profile
    profile = await supabase.get_user_profile(user.id)

    return AuthResponse(
        access_token=session.access_token,
        token_type="bearer",
        expires_in=session.expires_in,
        expires_at=session.expires_at,
        refresh_token=session.refresh_token,
        user=UserProfile(
            id=user.id,
            email=user.email,
            full_name=profile.get("full_name") if profile else None,
            company_name=profile.get("company_name") if profile else None,
            hubspot_portal_id=profile.get("hubspot_portal_id") if profile else None,
            created_at=user.created_at,
        ),
    )


@router.post("/signout", response_model=MessageResponse)
async def signout(
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Sign out the current user.
    Requires authentication.
    """
    await supabase.sign_out(access_token="")

    return MessageResponse(
        message="Successfully signed out",
        success=True,
    )


@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    user_id: str = Depends(get_current_user_id),
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Get current user's profile.
    Requires authentication.
    """
    profile = await supabase.get_user_profile(user_id)

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    return UserProfile(**profile)


@router.post("/password-reset", response_model=MessageResponse)
async def request_password_reset(
    request: PasswordResetRequest,
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Request password reset email.

    - **email**: Email address to send reset link to

    Note: Always returns success for security (doesn't reveal if email exists)
    """
    await supabase.send_password_reset(request.email)

    return MessageResponse(
        message="If an account exists with this email, you will receive a password reset link",
        success=True,
    )


@router.post("/password-update", response_model=MessageResponse)
async def update_password(
    request: PasswordUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    supabase: SupabaseService = Depends(get_supabase_service),
):
    """
    Update user password.
    Requires authentication.

    - **new_password**: New password (minimum 8 characters)
    """
    await supabase.update_password(
        access_token="",
        new_password=request.new_password,
    )

    return MessageResponse(
        message="Password updated successfully",
        success=True,
    )
