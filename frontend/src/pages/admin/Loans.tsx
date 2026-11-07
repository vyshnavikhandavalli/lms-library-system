import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loansApi } from '@/lib/api';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { BookMarked } from 'lucide-react';
import { format } from 'date-fns';

const STATUSES = ['', 'ACTIVE', 'RETURNED', 'OVERDUE', 'LOST'];

export default function AdminLoans() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['loans', page, search, status],
    queryFn: () => loansApi.list({ page, limit: 10, search, ...(status && { status }) }),
  });

  const loans = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">All Loans</h1><p className="text-gray-500 text-sm">View all borrowing transactions</p></div>

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search member or book..." />
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${status === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? <div className="py-16 text-center text-gray-400 text-sm">Loading...</div> :
          loans.length === 0 ? <EmptyState icon={BookMarked} title="No loans found" /> : (
            <>
              <div className="table-container rounded-none border-0">
                <table className="table">
                  <thead><tr><th>Book</th><th>Member</th><th>Issued</th><th>Due Date</th><th>Returned</th><th>Status</th><th>Fine</th></tr></thead>
                  <tbody>
                    {loans.map((l: Record<string, unknown>) => {
                      const book = (l.bookCopy as { book: { title: string } })?.book;
                      const member = (l.member as { user: { name: string } })?.user;
                      const fines = l.fines as Array<{ amount: number; isPaid: boolean }>;
                      const unpaidFine = fines?.filter(f => !f.isPaid).reduce((s, f) => s + f.amount, 0) ?? 0;
                      return (
                        <tr key={l.id as number}>
                          <td className="max-w-[160px] truncate font-medium">{book?.title}</td>
                          <td className="text-gray-600">{member?.name}</td>
                          <td className="text-gray-500 text-xs">{l.issueDate ? format(new Date(l.issueDate as string), 'dd MMM yyyy') : '—'}</td>
                          <td className="text-gray-500 text-xs">{l.dueDate ? format(new Date(l.dueDate as string), 'dd MMM yyyy') : '—'}</td>
                          <td className="text-gray-500 text-xs">{l.returnDate ? format(new Date(l.returnDate as string), 'dd MMM yyyy') : '—'}</td>
                          <td><StatusBadge status={l.status as string} /></td>
                          <td>{unpaidFine > 0 ? <span className="text-red-600 font-medium text-xs">₹{unpaidFine}</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pagination && <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} limit={10} onPageChange={setPage} />}
            </>
          )}
      </div>
    </div>
  );
}
