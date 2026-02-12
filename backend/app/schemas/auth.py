"""
Auth-related Pydantic schemas (sign up, sign in, profile, tokens, password reset).
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class SignUpRequest(BaseModel):
    """Request body for user registration."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "email": "jane@example.com",
                    "password": "securePass123",
                    "full_name": "Jane Doe",
                }
            ]
        }
    )

    email: EmailStr
    password: str = Field(..., min_length=8, description="At least 8 characters")
    full_name: str = Field(..., min_length=2)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class SignInRequest(BaseModel):
    """Request body for sign in."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "email": "jane@example.com",
                    "password": "securePass123",
                }
            ]
        }
    )

    email: EmailStr
    password: str


class UserProfile(BaseModel):
    """User profile returned in auth responses."""

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "email": "jane@example.com",
                    "full_name": "Jane Doe",
                    "company_name": "Acme Inc",
                    "hubspot_portal_id": "12345678",
                    "created_at": "2025-01-15T10:30:00Z",
                }
            ]
        },
    )

    id: str
    email: str
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    hubspot_portal_id: Optional[str] = None
    created_at: datetime


class AuthResponse(BaseModel):
    """Response after successful sign in or token refresh."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                    "token_type": "bearer",
                    "expires_in": 3600,
                    "expires_at": 1736932200,
                    "refresh_token": "v1.MRk...",
                    "user": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "email": "jane@example.com",
                        "full_name": "Jane Doe",
                        "company_name": None,
                        "hubspot_portal_id": None,
                        "created_at": "2025-01-15T10:30:00Z",
                    },
                }
            ]
        }
    )

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    expires_at: int
    refresh_token: str
    user: UserProfile


class PasswordResetRequest(BaseModel):
    """Request body to request a password reset email."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"email": "jane@example.com"}]
        }
    )

    email: EmailStr


class PasswordUpdateRequest(BaseModel):
    """Request body to set a new password (e.g. after reset)."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"new_password": "newSecurePass456"}]
        }
    )

    new_password: str = Field(..., min_length=8)


class MessageResponse(BaseModel):
    """Generic success/status message."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"message": "Password reset email sent.", "success": True},
                {"message": "Signed out successfully.", "success": True},
            ]
        }
    )

    message: str
    success: bool = True
