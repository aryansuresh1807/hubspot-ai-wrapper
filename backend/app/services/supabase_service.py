"""
Supabase client: auth (sign up, sign in, password reset), token verification, user profiles.
"""

import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from supabase import Client, create_client

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SupabaseService:
    def __init__(self) -> None:
        self.client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY,
        )
        self.auth_client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY,
        )

    async def sign_up(self, email: str, password: str, full_name: str) -> Dict[str, Any]:
        """Register a new user."""
        try:
            response = self.auth_client.auth.sign_up(
                {
                    "email": email,
                    "password": password,
                    "options": {
                        "data": {
                            "full_name": full_name,
                        }
                    },
                }
            )

            if not response.user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create user",
                )

            return {
                "user": response.user,
                "session": response.session,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Signup error: %s", str(e))
            if "already registered" in str(e).lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(e),
            )

    async def sign_in(self, email: str, password: str) -> Dict[str, Any]:
        """Sign in a user."""
        try:
            response = self.auth_client.auth.sign_in_with_password(
                {
                    "email": email,
                    "password": password,
                }
            )

            if not response.user or not response.session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials",
                )

            return {
                "user": response.user,
                "session": response.session,
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Signin error: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

    async def sign_out(self, access_token: str) -> bool:
        """Sign out a user."""
        try:
            self.client.auth.sign_out()
            return True
        except Exception as e:
            logger.error("Signout error: %s", str(e))
            return False

    async def verify_token(self, access_token: str) -> Dict[str, Any]:
        """Verify access token and return user."""
        try:
            response = self.client.auth.get_user(access_token)

            if not response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                )

            return response.user
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Token verification error: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user profile from database."""
        try:
            response = (
                self.client.table("user_profiles")
                .select("*")
                .eq("id", user_id)
                .execute()
            )

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
        except Exception as e:
            logger.error("Get profile error: %s", str(e))
            return None

    async def update_user_profile(
        self, user_id: str, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update user profile."""
        try:
            response = (
                self.client.table("user_profiles")
                .update(data)
                .eq("id", user_id)
                .execute()
            )

            if response.data and len(response.data) > 0:
                return response.data[0]
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found",
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Update profile error: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update profile",
            )

    async def send_password_reset(self, email: str) -> bool:
        """Send password reset email."""
        try:
            self.auth_client.auth.reset_password_for_email(
                email,
                options={
                    "redirect_to": f"{settings.frontend_url}/reset-password",
                },
            )
            return True
        except Exception as e:
            logger.error("Password reset error: %s", str(e))
            # Don't reveal if email exists
            return True

    async def update_password(self, access_token: str, new_password: str) -> bool:
        """Update user password."""
        try:
            self.client.auth.update_user(
                {
                    "password": new_password,
                }
            )
            return True
        except Exception as e:
            logger.error("Password update error: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update password",
            )


def get_supabase_service() -> SupabaseService:
    """Dependency for FastAPI."""
    return SupabaseService()
