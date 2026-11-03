import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  // 44px touch-target compliant
  const btnBase =
    'w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2';

  return (
    <nav className="flex items-center gap-1.5 flex-wrap justify-center py-2" aria-label="Pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${btnBase} border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-surface-subtle)]`}
        style={{
          color: 'var(--color-text-2)',
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
        aria-label="Previous page"
      >
        <ChevronLeft size={18} />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span
            key={`ellipsis-${i}`}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-sm font-bold select-none"
            style={{ color: 'var(--color-text-2)' }}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`${btnBase} border ${
              p === currentPage
                ? 'shadow-sv-sm'
                : 'hover:bg-[var(--color-surface-subtle)] hover:border-[var(--color-border-hover)]'
            }`}
            aria-current={p === currentPage ? 'page' : undefined}
            style={
              p === currentPage
                ? {
                    background: 'var(--color-accent)',
                    color: '#FFFFFF',
                    borderColor: 'var(--color-accent)',
                  }
                : {
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-1)',
                    borderColor: 'var(--color-border)',
                  }
            }
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${btnBase} border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-surface-subtle)]`}
        style={{
          color: 'var(--color-text-2)',
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
        aria-label="Next page"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
