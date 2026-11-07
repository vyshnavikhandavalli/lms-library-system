import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, loansApi } from '@/lib/api';
import { AlertCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/ui/EmptyState';
import { format, differenceInDays } from 'date-fns';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';

export default function LibrarianOverdue() {
  const qc = useQueryClient();
  const [returnModal, setReturnModal] = useState<Record<string, unknown> | null>(null);
  const [condition, setCondition] = useState('GOOD');

  const { data, isLoading } = useQuery({ queryKey: ['overdue-summary'], queryFn: reportsApi.overdueSummary });

  const returnMut = useMutation({
    mutationFn: ({ id, condition }: { id: number; condition: string }) => loansApi.return(id, { condition }),
    onSuccess: () => { toast.success('Book returned'); qc.invalidateQueries({ queryKey: ['overdue-summary'] }); setReturnModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const loans = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg"><AlertCircle size={20} className="text-red-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overdue Books</h1>
          <p className="text-gray-500 text-sm">All books past their due date</p>
        </div>
        {loans.length > 0 && <span className="ml-auto badge-red text-sm px-3 py-1">{loans.length} overdue</span>}
      </div>

      {loans.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{loans.length} book{loans.length > 1 ? 's are' : ' is'} overdue. Please contact the respective members.</p>
        </div>
      )}

      <div className="card">
        {isLoading ? <div className="py-16 text-center text-gray-400 text-sm">Loading...</div> :
          loans.length === 0 ? <EmptyState icon={AlertCircle} title="No overdue books" description="All books have been returned on time!" /> : (
            <div className="table-container rounded-none border-0">
              <table className="table">
                <thead><tr><th>Book</th><th>Member</th><th>Email</th><th>Due Date</th><th>Days Overdue</th><th>Fine (est.)</th><th>Actions</th></tr></thead>
                <tbody>
                  {loans.map((l: Record<string, unknown>) => {
                    const daysOverdue = l.daysOverdue as number || differenceInDays(new Date(), new Date(l.dueDate as string));
                    const estFine = daysOverdue * 5;
                    return (
                      <tr key={l.id as number}>
                        <td><p className="font-medium max-w-[160px] truncate">{(l.bookCopy as { book: { title: string } })?.book?.title}</p></td>
                        <td className="text-gray-700">{(l.member as { user: { name: string } })?.user?.name}</td>
                        <td className="text-xs text-gray-400">{(l.member as { user: { email: string } })?.user?.email}</td>
                        <td className="text-red-600 font-medium text-xs">{format(new Date(l.dueDate as string), 'dd MMM yyyy')}</td>
                        <td><span className="badge-red">{daysOverdue} days</span></td>
                        <td className="font-semibold text-red-600">₹{estFine}</td>
                        <td>
                          <button onClick={() => { setReturnModal(l); setCondition('GOOD'); }}
                            className="btn-secondary btn-sm"><RotateCcw size={12} /> Return</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <Modal isOpen={!!returnModal} onClose={() => setReturnModal(null)} title="Process Return" size="sm">
        {returnModal && (
          <div className="space-y-4">
            <div className="bg-red-50 rounded-lg p-4 text-sm border border-red-100">
              <p className="font-medium text-gray-900">{(returnModal.bookCopy as { book: { title: string } })?.book?.title}</p>
              <p className="text-gray-500 mt-0.5">Member: {(returnModal.member as { user: { name: string } })?.user?.name}</p>
              <p className="text-red-600 font-medium mt-1">Overdue by {differenceInDays(new Date(), new Date(returnModal.dueDate as string))} days — fine will be generated</p>
            </div>
            <div>
              <label className="label">Book Condition</label>
              <select value={condition} onChange={e => setCondition(e.target.value)} className="input">
                <option value="GOOD">Good</option><option value="DAMAGED">Damaged</option><option value="LOST">Lost</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setReturnModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => returnMut.mutate({ id: returnModal.id as number, condition })} disabled={returnMut.isPending} className="btn-primary">
                {returnMut.isPending ? 'Processing...' : 'Process Return'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
