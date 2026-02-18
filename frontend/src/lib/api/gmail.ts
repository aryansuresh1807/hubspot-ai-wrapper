/**
 * Gmail API for contact page: search emails, get message, extract contact.
 */

import { getAuthHeaders } from './activities';
import { ApiClientError, buildApiUrl } from './client';

export interface GmailSearchMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  date: string;
}

export interface GmailSearchResponse {
  messages: GmailSearchMessage[];
}

export interface GmailMessageResponse {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}

export interface ExtractedContact {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  job_title: string;
  company_name: string;
  company_domain: string;
  city: string;
  state_region: string;
  company_owner: string;
}

export async function gmailSearchEmails(query: string): Promise<GmailSearchMessage[]> {
  const url = buildApiUrl('/api/v1/gmail/search', { q: query });
  const headers = await getAuthHeaders();
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiClientError(res.statusText, res.status, text || undefined);
  }
  const data = (await res.json()) as GmailSearchResponse;
  return data.messages ?? [];
}

export async function gmailGetMessage(messageId: string): Promise<GmailMessageResponse> {
  const url = buildApiUrl(`/api/v1/gmail/messages/${encodeURIComponent(messageId)}`);
  const headers = await getAuthHeaders();
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiClientError(res.statusText, res.status, text || undefined);
  }
  return res.json() as Promise<GmailMessageResponse>;
}

export async function gmailExtractContact(messageId: string): Promise<ExtractedContact> {
  const url = buildApiUrl('/api/v1/gmail/extract-contact');
  const headers = await getAuthHeaders();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message_id: messageId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiClientError(res.statusText, res.status, text || undefined);
  }
  return res.json() as Promise<ExtractedContact>;
}
