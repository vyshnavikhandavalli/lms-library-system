import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { borrowRequestsApi, loansApi } from '@/lib/api';
import { CheckCircle, XCircle, BookMarked, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { format } from 'date-fns';

const STATUSES = ['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export default function LibrarianRequests() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('PENDING');
  const [rejectModal, setRejectModal] = useState<number | null>(null);
  const [issueModal, setIssueModal] = useState<Record<string, unknown> | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['borrow-requests', page, status],
    queryFn: () => borrowRequestsApi.list({ page, limit: 10, ...(status && { status }) }),
  });

  const approveMut = useMutation({
    mutationFn: borrowRequestsApi.approve,
    onSuccess: () => { toast.success('Request approved'); qc.invalidateQueries({ queryKey: ['borrow-requests'] }); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => borrowRequestsApi.reject(id, { rejectionReason: reason }),
    onSuccess: () => { toast.success('Request rejected'); qc.invalidateQueries({ queryKey: ['borrow-requests'] }); setRejectModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const issueMut = useMutation({
    mutationFn: loansApi.issue,
    onSuccess: () => { toast.success('Book issued successfully!'); qc.invalidateQueries({ queryKey: ['borrow-requests'] }); setIssueModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const requests = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Borrow Requests</h1><p className="text-gray-500 text-sm">Review and process member requests</p></div>

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${status === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>

        {isLoading ? <div className="py-16 text-center text-gray-400 text-sm">Loading...</div> :
          requests.length === 0 ? <EmptyState icon={BookMarked} title="No requests found" /> : (
            <>
              <div className="table-container rounded-none border-0">
                <table className="table">
                  <thead><tr><th>Book</th><th>Member</th><th>Requested</th><th>Availability</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {requests.map((r: Record<string, unknown>) => {
                      const book = r.book as { id: number; title: string; availableCopies: number };
                      const member = r.member as { user: { name: string; email: string } };
                      return (
                        <tr key={r.id as number}>
                          <td><p className="font-medium text-gray-900 max-w-[180px] truncate">{book?.title}</p></td>
                          <td><p className="text-gray-700">{member?.user?.name}</p><p className="text-xs text-gray-400">{member?.user?.email}</p></td>
                          <td className="text-xs text-gray-500">{format(new Date(r.requestDate as string), 'dd MMM yyyy')}</td>
                          <td><span className={`badge ${book?.availableCopies > 0 ? 'badge-green' : 'badge-red'}`}>{book?.availableCopies} available</span></td>
                          <td><StatusBadge status={r.status as string} /></td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              {r.status === 'PENDING' && (
                                <>
                                  <button onClick={() => approveMut.mutate(r.id as number)} disabled={approveMut.isPending}
                                    className="btn-success btn-sm"><CheckCircle size={12} /> Approve</button>
                                  <button onClick={() => { setRejectModal(r.id as number); setRejectReason(''); }}
                                    className="btn-danger btn-sm"><XCircle size={12} /> Reject</button>
                                </>
                              )}
                              {r.status === 'APPROVED' && (
                                <button onClick={() => setIssueModal(r)}
                                  className="btn-primary btn-sm"><Send size={12} /> Issue Book</button>
                              )}
                            </div>
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

      {/* Reject Modal */}
      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Request" size="sm">
        <div className="space-y-4">
          <div><label className="label">Reason for rejection *</label>
            <textarea required rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="input resize-none" placeholder="Provide a reason..." />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setRejectModal(null)} className="btn-secondary">Cancel</button>
            <button onClick={() => { if (rejectReason.trim() && rejectModal) rejectMut.mutate({ id: rejectModal, reason: rejectReason }); }}
              disabled={!rejectReason.trim() || rejectMut.isPending} className="btn-danger">
              {rejectMut.isPending ? 'Rejecting...' : 'Reject Request'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Issue Book Modal */}
      <Modal isOpen={!!issueModal} onClose={() => setIssueModal(null)} title="Issue Book" size="sm">
        {issueModal && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-900">{(issueModal.book as { title: string })?.title}</p>
              <p className="text-blue-600 mt-0.5">Member: {(issueModal.member as { user: { name: string } })?.user?.name}</p>
            </div>
            <p className="text-sm text-gray-600">Click confirm to issue an available copy. The due date will be set automatically based on library settings.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIssueModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => issueMut.mutate({ borrowRequestId: issueModal.id as number })}
                disabled={issueMut.isPending} className="btn-primary">
                {issueMut.isPending ? 'Issuing...' : 'Confirm Issue'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
