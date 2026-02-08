"""
Pydantic models for public.sessions (Supabase).
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SessionBase(BaseModel):
    user_id: UUID
    expires_at: datetime
    metadata: dict[str, Any] = {}


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    expires_at: datetime | None = None
    metadata: dict[str, Any] | None = None


class SessionInDB(SessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class Session(SessionInDB):
    pass
