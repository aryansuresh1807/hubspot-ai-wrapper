/**
 * Contacts API client.
 * Uses NEXT_PUBLIC_API_URL and Supabase session (Bearer) for auth.
 */

import { getAuthHeaders } from './activities';
import { ApiClientError } from './client';
import type {
  Contact,
  ContactCreate,
  ContactListResponse,
  ContactUpdate,
} from './types';

const getBaseUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  const apiUrl = typeof raw === 'string' ? raw.trim() : '';
  if (!apiUrl) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not configured. Set it in your environment variables (e.g. http://localhost:8000).'
    );
  }
  try {
    new URL(apiUrl);
  } catch {
    throw new Error(
      'NEXT_PUBLIC_API_URL must be a valid absolute URL (e.g. http://localhost:8000). Got: ' + JSON.stringify(raw)
    );
  }
  return apiUrl.replace(/\/$/, '');
};

async function fetchApi<T>(
  path: string,
  init: RequestInit & { params?: Record<string, string | undefined> } = {}
): Promise<T> {
  const { params, ...requestInit } = init;
  const base = getBaseUrl();
  const url = new URL(path.startsWith('/') ? path : `/${path}`, base);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, value);
    });
  }
  const headers = await getAuthHeaders();
  const res = await fetch(url.toString(), {
    ...requestInit,
    headers: { ...headers, ...requestInit.headers },
  });
  const text = await res.text();
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      // non-JSON
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
 * GET /api/v1/contacts/
 * List contacts with optional search filter.
 */
export async function getContacts(search?: string): Promise<ContactListResponse> {
  try {
    const params: Record<string, string> = {};
    if (search != null && search.trim()) params.search = search.trim();
    const path = '/api/v1/contacts/' + (Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '');
    return fetchApi<ContactListResponse>(path);
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new Error(
      err instanceof Error ? err.message : 'Failed to fetch contacts'
    );
  }
}

/**
 * GET /api/v1/contacts/{contactId}
 * Fetch a single contact.
 */
export async function getContact(contactId: string): Promise<Contact> {
  try {
    return fetchApi<Contact>(`/api/v1/contacts/${encodeURIComponent(contactId)}`);
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new Error(
      err instanceof Error ? err.message : 'Failed to fetch contact'
    );
  }
}

/**
 * POST /api/v1/contacts/
 * Create a new contact.
 */
export async function createContact(data: ContactCreate): Promise<Contact> {
  try {
    return fetchApi<Contact>('/api/v1/contacts/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new Error(
      err instanceof Error ? err.message : 'Failed to create contact'
    );
  }
}

/**
 * PUT /api/v1/contacts/{contactId}
 * Update an existing contact.
 */
export async function updateContact(
  contactId: string,
  data: ContactUpdate
): Promise<Contact> {
  try {
    return fetchApi<Contact>(
      `/api/v1/contacts/${encodeURIComponent(contactId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new Error(
      err instanceof Error ? err.message : 'Failed to update contact'
    );
  }
}

/**
 * DELETE /api/v1/contacts/{contactId}
 * Delete a contact.
 */
export async function deleteContact(contactId: string): Promise<void> {
  try {
    await fetchApi<unknown>(
      `/api/v1/contacts/${encodeURIComponent(contactId)}`,
      { method: 'DELETE' }
    );
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new Error(
      err instanceof Error ? err.message : 'Failed to delete contact'
    );
  }
}

/**
 * GET /api/v1/contacts/search?q={query}
 * Search contacts by name or email. Returns matching contacts array.
 */
export async function searchContacts(query: string): Promise<Contact[]> {
  try {
    const res = await fetchApi<ContactListResponse>(
      `/api/v1/contacts/search?q=${encodeURIComponent(query)}`
    );
    return res.contacts ?? [];
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new Error(
      err instanceof Error ? err.message : 'Failed to search contacts'
    );
  }
}

/**
 * GET /api/v1/contacts/by-company/{companyId}
 * List contacts for the given company (for account-scoped contact dropdown).
 */
export async function getContactsByCompany(companyId: string): Promise<Contact[]> {
  try {
    const res = await fetchApi<ContactListResponse>(
      `/api/v1/contacts/by-company/${encodeURIComponent(companyId)}`
    );
    return res.contacts ?? [];
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new Error(
      err instanceof Error ? err.message : 'Failed to fetch contacts for company'
    );
  }
}
