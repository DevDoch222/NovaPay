import {
  buildPaginatedResult,
  buildPaginationMeta,
  paginationOffset,
} from './pagination.util';

describe('pagination.util', () => {
  it('computes offset from page and limit', () => {
    expect(paginationOffset(1, 50)).toBe(0);
    expect(paginationOffset(3, 20)).toBe(40);
  });

  it('builds pagination meta', () => {
    expect(buildPaginationMeta(2, 10, 25)).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('builds paginated result envelope', () => {
    const result = buildPaginatedResult(['a', 'b'], 1, 50, 2);
    expect(result.items).toEqual(['a', 'b']);
    expect(result.pagination.total).toBe(2);
    expect(result.pagination.hasNext).toBe(false);
  });
});
