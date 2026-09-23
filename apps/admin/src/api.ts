const TOKEN_KEY = 'novapay_admin_token';
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type AdminUser = {
  id: string;
  phone: string;
  tag?: string | null;
  status: string;
  kycTier: string;
  platformRole: string;
};

export type Paginated<T> = {
  items: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

let unauthorizedHandler: (() => void) | null = null;

/** Clear session and return to login when JWT expires or is invalid. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function parseErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const o = data as {
    message?: string;
    error?: { message?: string; details?: unknown };
  };
  if (typeof o.message === 'string' && o.message) return o.message;
  if (typeof o.error?.message === 'string' && o.error.message) {
    return o.error.message;
  }
  const details = o.error?.details;
  if (Array.isArray(details) && details.length > 0) {
    return details
      .map((d) =>
        typeof d === 'string'
          ? d
          : typeof d === 'object' && d && 'message' in d
            ? String((d as { message: unknown }).message)
            : JSON.stringify(d),
      )
      .join('; ');
  }
  return fallback;
}

export function unwrapItems<T>(body: Paginated<T> | T[]): T[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object' && Array.isArray(body.items)) {
    return body.items;
  }
  return [];
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error(
      'Cannot reach API. Start apps/api (`npm run start:dev`) and keep the admin dev server on :5173.',
    );
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      unauthorizedHandler?.();
    }
    const msg = parseErrorMessage(data, res.statusText);
    if (res.status >= 500 && (!msg || msg === 'Internal Server Error')) {
      throw new Error(
        'API error. Check apps/api logs (`npm run start:dev`).',
      );
    }
    throw new Error(msg);
  }
  return data as T;
}

export async function requestOtp(phone: string) {
  return api<{ phone: string; expiresInSeconds?: number; devCode?: string }>(
    '/v1/auth/otp/request',
    {
      method: 'POST',
      body: JSON.stringify({ phone }),
    },
  );
}

export async function verifyOtp(phone: string, code: string) {
  return api<{
    accessToken: string;
    user: AdminUser;
  }>('/v1/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}
