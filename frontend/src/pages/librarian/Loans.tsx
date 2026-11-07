import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loansApi } from '@/lib/api';
import { RotateCcw, BookMarked } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { format } from 'date-fns';

const STATUSES = ['', 'ACTIVE', 'RETURNED', 'OVERDUE'];

export default function LibrarianLoans() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [returnModal, setReturnModal] = useState<Record<string, unknown> | null>(null);
  const [condition, setCondition] = useState('GOOD');

  const { data, isLoading } = useQuery({
    queryKey: ['loans', page, search, status],
    queryFn: () => loansApi.list({ page, limit: 10, search, ...(status && { status }) }),
  });

  const returnMut = useMutation({
    mutationFn: ({ id, condition }: { id: number; condition: string }) => loansApi.return(id, { condition }),
    onSuccess: () => { toast.success('Book returned successfully'); qc.invalidateQueries({ queryKey: ['loans'] }); setReturnModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const loans = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Loans Management</h1><p className="text-gray-500 text-sm">Issue and process book returns</p></div>

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
                  <thead><tr><th>Book</th><th>Copy Code</th><th>Member</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {loans.map((l: Record<string, unknown>) => {
                      const copy = l.bookCopy as { copyCode: string; book: { title: string } };
                      const member = l.member as { user: { name: string } };
                      const isActive = ['ACTIVE', 'OVERDUE'].includes(l.status as string);
                      return (
                        <tr key={l.id as number}>
                          <td><p className="font-medium max-w-[160px] truncate">{copy?.book?.title}</p></td>
                          <td className="font-mono text-xs text-gray-500">{copy?.copyCode}</td>
                          <td className="text-gray-600">{member?.user?.name}</td>
                          <td className="text-xs text-gray-500">{format(new Date(l.issueDate as string), 'dd MMM yyyy')}</td>
                          <td className={`text-xs font-medium ${l.status === 'OVERDUE' ? 'text-red-600' : 'text-gray-500'}`}>{format(new Date(l.dueDate as string), 'dd MMM yyyy')}</td>
                          <td><StatusBadge status={l.status as string} /></td>
                          <td>
                            {isActive && (
                              <button onClick={() => { setReturnModal(l); setCondition('GOOD'); }}
                                className="btn-secondary btn-sm"><RotateCcw size={12} /> Return</button>
                            )}
                          </td>
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

      {/* Return Modal */}
      <Modal isOpen={!!returnModal} onClose={() => setReturnModal(null)} title="Process Return" size="sm">
        {returnModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <p className="font-medium text-gray-900">{(returnModal.bookCopy as { book: { title: string } })?.book?.title}</p>
              <p className="text-gray-500 mt-0.5">Member: {(returnModal.member as { user: { name: string } })?.user?.name}</p>
              <p className="text-gray-500">Due: {format(new Date(returnModal.dueDate as string), 'dd MMM yyyy')}</p>
              {new Date() > new Date(returnModal.dueDate as string) && (
                <p className="text-red-600 font-medium mt-1">⚠ This book is overdue — a fine will be generated</p>
              )}
            </div>
            <div>
              <label className="label">Book Condition on Return</label>
              <select value={condition} onChange={e => setCondition(e.target.value)} className="input">
                <option value="GOOD">Good</option>
                <option value="DAMAGED">Damaged</option>
                <option value="LOST">Lost</option>
              </select>
              {(condition === 'DAMAGED' || condition === 'LOST') && (
                <p className="text-xs text-red-500 mt-1">An additional fine will be applied for {condition.toLowerCase()} books.</p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setReturnModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => returnMut.mutate({ id: returnModal.id as number, condition })}
                disabled={returnMut.isPending} className="btn-primary">
                {returnMut.isPending ? 'Processing...' : 'Process Return'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
