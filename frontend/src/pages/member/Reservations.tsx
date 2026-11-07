import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '@/lib/api';
import { Bookmark, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { format } from 'date-fns';

export default function MemberReservations() {
  const qc = useQueryClient();
  const [page] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['my-reservations', page],
    queryFn: () => reservationsApi.list({ page, limit: 10 }),
  });

  const cancelMut = useMutation({
    mutationFn: reservationsApi.cancel,
    onSuccess: () => {
      toast.success('Reservation cancelled');
      qc.invalidateQueries({ queryKey: ['my-reservations'] });
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const reservations = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Reservations</h1>
        <p className="text-gray-500 text-sm">Books you have reserved — you'll be notified when available</p>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading...</div>
        ) : reservations.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No reservations"
            description="When a book is unavailable, you can reserve it from the Browse Books page"
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Author</th>
                <th>Queue Position</th>
                <th>Reserved On</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r: Record<string, unknown>) => {
                const book = r.book as { title: string; author: string };
                return (
                  <tr key={r.id as number}>
                    <td className="font-medium text-gray-900">{book?.title}</td>
                    <td className="text-gray-500">{book?.author}</td>
                    <td>
                      <span className="badge-purple">#{r.queuePosition as number}</span>
                    </td>
                    <td className="text-xs text-gray-500">
                      {format(new Date(r.reservedAt as string), 'dd MMM yyyy')}
                    </td>
                    <td className="text-xs text-gray-500">
                      {r.expiresAt ? format(new Date(r.expiresAt as string), 'dd MMM yyyy') : '—'}
                    </td>
                    <td><StatusBadge status={r.status as string} /></td>
                    <td>
                      {r.status === 'ACTIVE' && (
                        <button
                          onClick={() => {
                            if (window.confirm('Cancel this reservation?'))
                              cancelMut.mutate(r.id as number);
                          }}
                          className="btn-danger btn-sm"
                          disabled={cancelMut.isPending}
                        >
                          <XCircle size={12} /> Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Info box */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-sm text-violet-700">
        <p className="font-medium mb-1">How reservations work</p>
        <ul className="space-y-1 text-violet-600 list-disc list-inside text-xs">
          <li>You are placed in a queue when the book has no available copies.</li>
          <li>When a copy is returned, the next member in queue is notified.</li>
          <li>You will have a set number of days to collect the book before it expires.</li>
          <li>You can cancel an active reservation at any time.</li>
        </ul>
      </div>
    </div>
  );
}
