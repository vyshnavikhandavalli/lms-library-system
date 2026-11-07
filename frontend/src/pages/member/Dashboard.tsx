import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import StatsCard from '@/components/ui/StatsCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { BookOpen, AlertCircle, Clock, Bookmark, DollarSign } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function MemberDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'member'], queryFn: dashboardApi.member });
  const d = data?.data;
  const navigate = useNavigate();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {d?.member?.name}</h1>
        <p className="text-gray-500 text-sm mt-1">Member Code: <span className="font-mono font-medium">{d?.member?.memberCode}</span> · Max {d?.member?.maxBooksAllowed} books</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Books Borrowed" value={d?.stats?.booksCurrentlyBorrowed ?? 0} icon={BookOpen} color="bg-blue-500" />
        <StatsCard title="Overdue" value={d?.stats?.overdueBooks ?? 0} icon={AlertCircle} color="bg-red-500" />
        <StatsCard title="Pending Requests" value={d?.stats?.pendingRequests ?? 0} icon={Clock} color="bg-amber-500" />
        <StatsCard title="Reservations" value={d?.stats?.activeReservations ?? 0} icon={Bookmark} color="bg-purple-500" />
        <StatsCard title="Outstanding Fines" value={`₹${(d?.stats?.outstandingFines ?? 0).toFixed(2)}`} icon={DollarSign} color="bg-rose-500" />
      </div>

      {/* Active Loans */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Currently Borrowed</h3>
          <button onClick={() => navigate('/member/my-loans')} className="text-xs text-blue-600 hover:underline">View all</button>
        </div>
        <div className="divide-y divide-gray-50">
          {(d?.activeLoans ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 px-5 py-8 text-center">No active loans</p>
          ) : (d?.activeLoans ?? []).map((l: { id: number; bookCopy: { book: { title: string; author: string } }; dueDate: string; status: string }) => {
            const daysLeft = differenceInDays(new Date(l.dueDate), new Date());
            const isOverdue = daysLeft < 0;
            return (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{l.bookCopy?.book?.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{l.bookCopy?.book?.author}</p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <StatusBadge status={l.status} />
                  <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-semibold' : daysLeft <= 3 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {isOverdue ? `${Math.abs(daysLeft)} days overdue` : `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent History */}
      {(d?.recentHistory ?? []).length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-800">Recent Return History</h3></div>
          <div className="divide-y divide-gray-50">
            {d?.recentHistory.map((l: { id: number; bookCopy: { book: { title: string } }; returnDate: string }) => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                <p className="text-sm text-gray-700 truncate">{l.bookCopy?.book?.title}</p>
                <p className="text-xs text-gray-400 ml-4 flex-shrink-0">Returned {format(new Date(l.returnDate), 'dd MMM yyyy')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
