import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { finesApi } from '@/lib/api';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import { AlertCircle, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AdminFines() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [isPaid, setIsPaid] = useState<string>('');
  const [payModal, setPayModal] = useState<Record<string, unknown> | null>(null);
  const [payForm, setPayForm] = useState({ amountPaid: '', paymentMethod: 'Cash', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['fines', page, isPaid],
    queryFn: () => finesApi.list({ page, limit: 10, ...(isPaid !== '' && { isPaid }) }),
  });

  const payMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => finesApi.pay(id, data),
    onSuccess: () => { toast.success('Payment recorded'); qc.invalidateQueries({ queryKey: ['fines'] }); setPayModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const fines = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Fines</h1><p className="text-gray-500 text-sm">Manage overdue and damage fines</p></div>

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          {[['', 'All'], ['false', 'Unpaid'], ['true', 'Paid']].map(([v, l]) => (
            <button key={v} onClick={() => { setIsPaid(v); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isPaid === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{l}
            </button>
          ))}
        </div>
        {isLoading ? <div className="py-16 text-center text-gray-400 text-sm">Loading...</div> :
          fines.length === 0 ? <EmptyState icon={AlertCircle} title="No fines found" /> : (
            <>
              <div className="table-container rounded-none border-0">
                <table className="table">
                  <thead><tr><th>Member</th><th>Book</th><th>Type</th><th>Amount</th><th>Days</th><th>Status</th><th>Generated</th><th>Actions</th></tr></thead>
                  <tbody>
                    {fines.map((f: Record<string, unknown>) => (
                      <tr key={f.id as number}>
                        <td className="font-medium">{((f.member as { user: { name: string } })?.user?.name)}</td>
                        <td className="text-gray-600 text-xs max-w-[140px] truncate">{((f.loan as { bookCopy: { book: { title: string } } })?.bookCopy?.book?.title)}</td>
                        <td><span className="badge-yellow">{f.fineType as string}</span></td>
                        <td className="font-semibold text-red-600">₹{(f.amount as number).toFixed(2)}</td>
                        <td className="text-gray-500">{f.daysOverdue as number > 0 ? `${f.daysOverdue} days` : '—'}</td>
                        <td>{f.isPaid ? <span className="badge-green">Paid</span> : <span className="badge-red">Unpaid</span>}</td>
                        <td className="text-xs text-gray-400">{format(new Date(f.generatedAt as string), 'dd MMM yyyy')}</td>
                        <td>
                          {!f.isPaid && (
                            <button onClick={() => { setPayModal(f); setPayForm({ amountPaid: String(f.amount), paymentMethod: 'Cash', notes: '' }); }}
                              className="btn-success btn-sm"><DollarSign size={12} /> Pay</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination && <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} limit={10} onPageChange={setPage} />}
            </>
          )}
      </div>

      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title="Record Fine Payment" size="sm">
        <form onSubmit={e => { e.preventDefault(); payMut.mutate({ id: payModal?.id as number, data: { ...payForm, amountPaid: parseFloat(payForm.amountPaid) } }); }} className="space-y-4">
          <div><label className="label">Amount (₹)</label><input required type="number" step="0.01" value={payForm.amountPaid} onChange={e => setPayForm(p => ({ ...p, amountPaid: e.target.value }))} className="input" /></div>
          <div><label className="label">Payment Method</label>
            <select value={payForm.paymentMethod} onChange={e => setPayForm(p => ({ ...p, paymentMethod: e.target.value }))} className="input">
              <option>Cash</option><option>UPI</option><option>Card</option><option>Online</option>
            </select>
          </div>
          <div><label className="label">Notes</label><input value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} className="input" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setPayModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={payMut.isPending} className="btn-success">{payMut.isPending ? 'Recording...' : 'Record Payment'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
