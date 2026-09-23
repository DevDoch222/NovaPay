import type { PaginatedResult, PaginationMeta } from './api.types';

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function buildPaginatedResult<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResult<T> {
  return {
    items,
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export function paginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
