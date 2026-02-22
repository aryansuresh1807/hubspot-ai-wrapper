/**
 * Companies (accounts) API client.
 */

import { getAuthHeaders } from './activities';
import { ApiClientError, buildApiUrl } from './client';

export interface CompanySearchResult {
  id: string;
  name?: string | null;
  domain?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface CompanyCreate {
  name: string;
  domain: string;
  city?: string | null;
  state?: string | null;
  company_owner?: string | null;
}

export interface CompanyDetailResponse {
  id: string;
  name?: string | null;
  domain?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface CompanyListResponse {
  companies: CompanySearchResult[];
}

async function fetchApi<T>(
  path: string,
  init: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...requestInit } = init;
  const url = buildApiUrl(path, params);
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    ...requestInit,
    headers: { ...headers, ...requestInit.headers },
  });
  const text = await res.text();
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      // ignore
    }
  }
  if (!res.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? (data as { detail: string | Record<string, unknown> }).detail
        : text;
    throw new ApiClientError(
      res.statusText || 'Request failed',
      res.status,
      typeof detail === 'string' ? detail : (detail as Record<string, unknown>)
    );
  }
  return (data ?? {}) as T;
}

/**
 * GET /api/v1/companies/search?q=
 * Search companies by name or domain.
 */
export async function searchCompanies(query: string): Promise<CompanySearchResult[]> {
  const res = await fetchApi<CompanyListResponse>(
    `/api/v1/companies/search?q=${encodeURIComponent(query)}`
  );
  return res.companies ?? [];
}

/**
 * POST /api/v1/companies
 * Create a company in HubSpot.
 */
export async function createCompany(data: CompanyCreate): Promise<CompanyDetailResponse> {
  return fetchApi<CompanyDetailResponse>('/api/v1/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
