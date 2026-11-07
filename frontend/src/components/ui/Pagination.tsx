import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  total: number;
  limit: number;
}

export default function Pagination({ page, totalPages, onPageChange, total, limit }: Props) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <p className="text-sm text-gray-500">Showing {start}–{end} of {total}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm px-3 text-gray-700">Page {page} of {totalPages}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
