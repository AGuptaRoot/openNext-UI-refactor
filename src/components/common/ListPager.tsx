import React from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { ListPaginationMeta } from '../../utils/listPagination';

export type { ListPaginationMeta };

interface ListPagerProps {
  pagination: ListPaginationMeta | null | undefined;
  onPageChange: (page: number) => void;
  label?: string;
  alwaysShowCount?: boolean;
}

export const ListPager: React.FC<ListPagerProps> = ({
  pagination,
  onPageChange,
  label = 'items',
  alwaysShowCount = true,
}) => {
  if (!pagination || pagination.total <= 0) return null;

  if (pagination.totalPages <= 1) {
    if (!alwaysShowCount) return null;
    return (
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
        Showing {Math.min(pagination.limit, pagination.total)} of {pagination.total} {label}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3">
      <span className="text-xs text-zinc-500">
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeftIcon sx={{ fontSize: 18 }} />
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 bg-white disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </button>
      </div>
    </div>
  );
};
