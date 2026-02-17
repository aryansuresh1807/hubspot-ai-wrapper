/**
 * Integrations API: Gmail connect/disconnect and status.
 * Uses authenticated API requests (Bearer from Supabase session).
 */

import { getAuthHeaders } from '@/lib/api/activities';
import { buildApiUrl } from '@/lib/api/client';

export type GmailStatusResponse = {
  connected: boolean;
  email?: string | null;
  last_connected_at?: string | null;
};

export async function getGmailStatus(): Promise<GmailStatusResponse> {
  const url = buildApiUrl('/api/v1/auth/gmail/status');
  const headers = await getAuthHeaders();
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<GmailStatusResponse>;
}

/** Returns the Google OAuth URL to redirect the user to. */
export async function getGmailConnectUrl(): Promise<{ url: string }> {
  const url = buildApiUrl('/api/v1/auth/gmail');
  const headers = await getAuthHeaders();
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<{ url: string }>;
}

export async function disconnectGmail(): Promise<void> {
  const url = buildApiUrl('/api/v1/auth/gmail');
  const headers = await getAuthHeaders();
  const res = await fetch(url, { method: 'DELETE', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
}
