import type { ApiErrorCodeValue } from './error-codes';

export type ApiErrorBody = {
  code: ApiErrorCodeValue;
  message: string;
  details?: unknown;
};

export type ApiErrorResponse = {
  success: false;
  /** Backward-compatible top-level message for existing clients */
  message: string;
  error: ApiErrorBody;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type PaginatedResult<T> = {
  items: T[];
  pagination: PaginationMeta;
};
