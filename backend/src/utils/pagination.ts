import { badRequest } from './errors';

/**
 * Parsed and validated pagination params, ready for SQL LIMIT/OFFSET.
 */
export type Pagination = {
  page: number;
  limit: number;
  offset: number;
};

/**
 * Default and maximum bounds. Keep MAX_LIMIT small enough that a single
 * request never returns unreasonable amounts of data.
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse ?page= and ?limit= from a request query object.
 * Applies defaults for missing values, validates ranges,
 * throws 400 AppError on invalid input.
 *
 * Usage in a controller:
 *   const pagination = parsePagination(req.query);
 *   const result = await service.list(user, pagination);
 */
export function parsePagination(query: unknown): Pagination {
  const q = (query ?? {}) as Record<string, unknown>;

  const page = parsePositiveInt(q.page, DEFAULT_PAGE, 'page');
  const limit = parsePositiveInt(q.limit, DEFAULT_LIMIT, 'limit');

  if (limit > MAX_LIMIT) {
    throw badRequest('INVALID_PAGINATION', `limit cannot exceed ${MAX_LIMIT}`);
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

/**
 * Build the wrapped list response envelope.
 * Every paginated list endpoint uses this to keep response shape consistent.
 */
export function paginatedResponse<TKey extends string, TItem>(
  key: TKey,
  items: TItem[],
  pagination: Pagination,
  total: number
): { [K in TKey]: TItem[] } & { page: number; limit: number; total: number } {
  return {
    [key]: items,
    page: pagination.page,
    limit: pagination.limit,
    total,
  } as { [K in TKey]: TItem[] } & { page: number; limit: number; total: number };
}

function parsePositiveInt(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;

  const asString = Array.isArray(value) ? value[0] : value;
  if (typeof asString !== 'string') {
    throw badRequest('INVALID_PAGINATION', `${name} must be a positive integer`);
  }

  if (!/^\d+$/.test(asString)) {
    throw badRequest('INVALID_PAGINATION', `${name} must be a positive integer`);
  }

  const n = parseInt(asString, 10);
  if (n < 1) {
    throw badRequest('INVALID_PAGINATION', `${name} must be at least 1`);
  }

  return n;
}
