"""
Common Pydantic schemas (pagination, error, etc.).
"""

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class MessageResponse(BaseModel):
    message: str


class ErrorDetail(BaseModel):
    detail: str


class PaginatedResponse(BaseModel, Generic[T]):
    """Matches frontend PaginatedResponse<T>. items only; total/after in subclass or extra."""
    items: list[T]
    total: int | None = None
    after: str | None = None
