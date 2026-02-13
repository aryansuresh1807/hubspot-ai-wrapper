/**
 * API client for the FastAPI backend.
 * Uses fetch with NEXT_PUBLIC_API_URL. For axios, swap this module implementation.
 */

const getBaseUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  const apiUrl = typeof raw === 'string' ? raw.trim() : '';
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured. Please set it in your environment variables (e.g. http://localhost:8000).');
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
 * Request to the backend API. Automatically prefixes path with NEXT_PUBLIC_API_URL.
 */
export async function apiRequest<T = unknown>(
  path: string,
  config: RequestConfig = {}
): Promise<T> {
  const { params, ...init } = config;
  const base = getBaseUrl();
  const url = new URL(path.startsWith('/') ? path : `/${path}`, base);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }
  const res = await fetch(url.toString(), {
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
