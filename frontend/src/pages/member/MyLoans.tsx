import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loansApi } from '@/lib/api';
import { BookOpen } from 'lucide-react';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { format, differenceInDays } from 'date-fns';

const TABS = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Returned', value: 'RETURNED' },
  { label: 'All', value: '' },
];

export default function MemberMyLoans() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ACTIVE');

  const { data, isLoading } = useQuery({
    queryKey: ['my-loans', page, status],
    queryFn: () => loansApi.my({ page, limit: 10, ...(status && { status }) }),
  });

  const loans = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Loans</h1>
        <p className="text-gray-500 text-sm">Your borrowing history and active loans</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.value} onClick={() => { setStatus(t.value); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              status === t.value
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading loans...</div>
        ) : loans.length === 0 ? (
          <EmptyState icon={BookOpen} title="No loans found" description="Your borrowing history will appear here" />
        ) : (
          <>
            <div className="table-container rounded-none border-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Category</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Return Date</th>
                    <th>Status</th>
                    <th>Fine</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l: Record<string, unknown>) => {
                    const book = (l.bookCopy as { book: { title: string; author: string; category: { name: string } } })?.book;
                    const daysLeft = differenceInDays(new Date(l.dueDate as string), new Date());
                    const isOverdue = l.status === 'OVERDUE';
                    const fines = l.fines as Array<{ amount: number; isPaid: boolean }>;
                    const unpaid = fines?.filter(f => !f.isPaid).reduce((s, f) => s + f.amount, 0) ?? 0;

                    return (
                      <tr key={l.id as number}>
                        <td>
                          <p className="font-medium text-gray-900 truncate max-w-[180px]">{book?.title}</p>
                          <p className="text-xs text-gray-400">{book?.author}</p>
                        </td>
                        <td>
                          <span className="badge-purple">{book?.category?.name}</span>
                        </td>
                        <td className="text-xs text-gray-500">
                          {format(new Date(l.issueDate as string), 'dd MMM yyyy')}
                        </td>
                        <td>
                          <p className={`text-xs font-medium ${isOverdue ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>
                            {format(new Date(l.dueDate as string), 'dd MMM yyyy')}
                          </p>
                          {l.status === 'ACTIVE' && !isOverdue && (
                            <p className="text-xs text-gray-400">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</p>
                          )}
                          {isOverdue && (
                            <p className="text-xs text-red-500">{Math.abs(daysLeft)} days overdue</p>
                          )}
                        </td>
                        <td className="text-xs text-gray-500">
                          {l.returnDate ? format(new Date(l.returnDate as string), 'dd MMM yyyy') : '—'}
                        </td>
                        <td><StatusBadge status={l.status as string} /></td>
                        <td>
                          {unpaid > 0 ? (
                            <span className="text-red-600 font-semibold text-sm">₹{unpaid.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pagination && (
              <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} limit={10} onPageChange={setPage} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
