"""
Security utilities: JWT validation via Supabase, dependency injection for auth.
"""

from typing import Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services.supabase_service import SupabaseService, get_supabase_service

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: SupabaseService = Depends(get_supabase_service),
) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user.
    Validates JWT token and returns user data.
    """
    token = credentials.credentials

    try:
        user = await supabase.verify_token(token)
        return user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_id(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> str:
    """Extract user ID from current user."""
    user_id = (
        current_user.get("id")
        if isinstance(current_user, dict)
        else getattr(current_user, "id", None)
    )
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return str(user_id)
