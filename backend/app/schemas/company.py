"""
Company (account) schema for API. Used for search and create.
"""

from pydantic import BaseModel, Field


class CompanyCreate(BaseModel):
    """Request body for creating a company in HubSpot."""
    name: str = Field(..., min_length=1, description="Company name")
    domain: str = Field(..., min_length=1, description="Company domain (e.g. example.com)")
    city: str | None = None
    state: str | None = None
    company_owner: str | None = Field(None, description="HubSpot owner ID, if known")


class CompanySearchResult(BaseModel):
    """Single company in search results."""
    id: str
    name: str | None = None
    domain: str | None = None
    city: str | None = None
    state: str | None = None


class CompanyListResponse(BaseModel):
    """List of companies (search results)."""
    companies: list[CompanySearchResult]


class CompanyDetailResponse(BaseModel):
    """Single company (create response)."""
    id: str
    name: str | None = None
    domain: str | None = None
    city: str | None = None
    state: str | None = None
