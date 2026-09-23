import { API_BASE_URL } from './config';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? extractMessage(body) ?? `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  const msg = record.message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg) && msg.every((m) => typeof m === 'string')) {
    return msg.join(', ');
  }
  const err = record.error;
  if (err && typeof err === 'object' && 'message' in err) {
    const nested = (err as { message?: unknown }).message;
    if (typeof nested === 'string') return nested;
  }
  return undefined;
}

export type PaginatedResult<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

/** Unwrap Phase 5 paginated list responses or pass through legacy arrays. */
export function unwrapItems<T>(body: T[] | PaginatedResult<T>): T[] {
  if (Array.isArray(body)) return body;
  if (
    body &&
    typeof body === 'object' &&
    'items' in body &&
    Array.isArray((body as PaginatedResult<T>).items)
  ) {
    return (body as PaginatedResult<T>).items;
  }
  return (body as unknown as T[]) ?? [];
}

type Options = {
  method?: string;
  token?: string;
  body?: unknown;
};

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Network error';
    throw new ApiError(
      0,
      null,
      `Cannot reach API at ${API_BASE_URL} (${detail}). On a phone use your computer’s LAN IP, e.g. http://192.168.x.x:3000`,
    );
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, parsed);
  }

  return parsed as T;
}
