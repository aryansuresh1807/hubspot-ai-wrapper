/**
 * API client for the FastAPI backend.
 * - Local: uses NEXT_PUBLIC_API_URL (e.g. http://localhost:8000).
 * - Deployed (Vercel): uses relative URLs so requests hit same origin and Next.js
 *   rewrites /api/v1/* to the backend (set API_URL on Vercel). No CORS/build-time env issues.
 */

const isLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname ?? '';
  return h === 'localhost' || h === '127.0.0.1';
};

export function getBaseUrl(): string {
  if (typeof window !== 'undefined' && !isLocalhost()) {
    return '';
  }
  const raw = process.env.NEXT_PUBLIC_API_URL;
  const apiUrl = typeof raw === 'string' ? raw.trim() : '';
  if (!apiUrl) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not configured. For local dev set it (e.g. http://localhost:8000). For Vercel set API_URL to your Railway backend URL and redeploy.'
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
}

/** Params for buildApiUrl: values can be scalar or array (for repeated query keys). */
export type ApiUrlParams = Record<
  string,
  string | string[] | number | boolean | undefined
>;

/**
 * Build the full or relative URL for an API request. When base is '' (deployed with proxy),
 * returns a relative path so the request is rewritten to the backend by Next.js.
 * Supports array params (appends multiple values for the same key).
 */
export function buildApiUrl(path: string, params?: ApiUrlParams): string {
  const base = getBaseUrl();
  const pathStr = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    if (!params || !Object.keys(params).length) return pathStr;
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return;
      if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
      else search.set(key, String(value));
    });
    return pathStr + '?' + search.toString();
  }
  const url = new URL(pathStr, base);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)));
      else url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

export type ApiError = {
  detail: string | Record<string, unknown>;
  status: number;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string | Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      // non-JSON response
    }
  }
  if (!res.ok) {
    const detail = data && typeof data === 'object' && 'detail' in data ? (data as { detail: string | Record<string, unknown> }).detail : text;
    throw new ApiClientError(
      res.statusText || 'Request failed',
      res.status,
      typeof detail === 'string' ? detail : (detail as Record<string, unknown>)
    );
  }
  return (data ?? {}) as T;
}

export type RequestConfig = RequestInit & {
  params?: Record<string, string | number | boolean | undefined>;
};

/**
 * Request to the backend API. Uses getBaseUrl() or relative path (when deployed with API_URL proxy).
 */
export async function apiRequest<T = unknown>(
  path: string,
  config: RequestConfig = {}
): Promise<T> {
  const { params, ...init } = config;
  const url = buildApiUrl(path, params);
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  return handleResponse<T>(res);
}

/**
 * Convenience methods (optional; you can also use apiRequest directly).
 */
export const api = {
  get: <T = unknown>(path: string, config?: RequestConfig) =>
    apiRequest<T>(path, { ...config, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, config?: RequestConfig) =>
    apiRequest<T>(path, { ...config, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = unknown>(path: string, body?: unknown, config?: RequestConfig) =>
    apiRequest<T>(path, { ...config, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown, config?: RequestConfig) =>
    apiRequest<T>(path, { ...config, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = unknown>(path: string, config?: RequestConfig) =>
    apiRequest<T>(path, { ...config, method: 'DELETE' }),
};
