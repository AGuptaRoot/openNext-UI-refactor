export interface ListPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function normalizeListLimit(limit?: number, fallback = 20, max = 100): number {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

export function resolveListPage(page?: number): number {
  const value = Number(page);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

/** Ensure page/limit are always sent so the API never silently defaults to 10. */
export function applyListPaginationParams(
  query: URLSearchParams,
  params: { page?: number; limit?: number },
  fallbackLimit = 20
): { page: number; limit: number } {
  const page = resolveListPage(params.page);
  const limit = normalizeListLimit(params.limit, fallbackLimit);
  query.set('page', String(page));
  query.set('limit', String(limit));
  return { page, limit };
}

export function paginateLocalItems<T>(
  items: T[],
  page = 1,
  limit = 20
): { data: T[]; pagination: ListPaginationMeta } {
  const safePage = resolveListPage(page);
  const safeLimit = normalizeListLimit(limit);
  const total = items.length;
  const start = (safePage - 1) * safeLimit;
  return {
    data: items.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit) || 1),
    },
  };
}

export function fallbackPagination(
  page: number,
  limit: number,
  itemCount: number,
  remote?: Partial<ListPaginationMeta> | null
): ListPaginationMeta {
  if (remote && remote.total != null) {
    return {
      page: Number(remote.page) || page,
      limit: Number(remote.limit) || limit,
      total: Number(remote.total) || 0,
      totalPages: Math.max(1, Number(remote.totalPages) || Math.ceil(Number(remote.total) / (Number(remote.limit) || limit)) || 1),
    };
  }
  return {
    page,
    limit,
    total: itemCount,
    totalPages: Math.max(1, Math.ceil(itemCount / limit) || 1),
  };
}
