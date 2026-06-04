import { config } from '@/lib/config';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from './errors';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header (auth endpoints). */
  anonymous?: boolean;
  query?: Record<string, string | number | undefined>;
}

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refreshToken, setTokens, clear } = useAuthStore.getState();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${config.apiBaseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          await clear();
          return false;
        }
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        await setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        await clear();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${config.apiBaseUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  const fieldErrors = Array.isArray(body.errors)
    ? Object.fromEntries(
        (body.errors as Array<{ path: string; message: string }>).map((e) => [e.path, e.message]),
      )
    : undefined;
  return new ApiError({
    status: res.status,
    type: (body.type as string) ?? 'about:blank',
    detail: (body.detail as string) ?? res.statusText,
    fieldErrors,
  });
}

async function request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const { method = 'GET', body, anonymous, query } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!anonymous) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Transparent refresh-and-retry on a single 401.
  if (res.status === 401 && !anonymous && retry) {
    const refreshed = await refreshTokens();
    if (refreshed) return request<T>(path, options, false);
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown, anonymous = false) =>
    request<T>(path, { method: 'POST', body, anonymous }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
