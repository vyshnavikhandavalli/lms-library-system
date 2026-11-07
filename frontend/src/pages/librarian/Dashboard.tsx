import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import StatsCard from '@/components/ui/StatsCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { ClipboardList, BookMarked, AlertCircle, TrendingUp, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function LibrarianDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'librarian'], queryFn: dashboardApi.librarian });
  const d = data?.data;
  const navigate = useNavigate();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Librarian Dashboard</h1><p className="text-gray-500 text-sm">Today's library operations overview</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard title="Pending Requests" value={d?.stats?.pendingRequests ?? 0} icon={ClipboardList} color="bg-amber-500" subtitle="Awaiting approval" />
        <StatsCard title="Active Loans" value={d?.stats?.activeLoans ?? 0} icon={BookMarked} color="bg-blue-500" subtitle="Currently borrowed" />
        <StatsCard title="Overdue" value={d?.stats?.overdueLoans ?? 0} icon={AlertCircle} color="bg-red-500" subtitle="Past due date" />
        <StatsCard title="Today Issued" value={d?.stats?.todayIssued ?? 0} icon={TrendingUp} color="bg-emerald-500" subtitle="Issued today" />
        <StatsCard title="Today Returned" value={d?.stats?.todayReturned ?? 0} icon={RotateCcw} color="bg-indigo-500" subtitle="Returned today" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Requests */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Pending Borrow Requests</h3>
            <button onClick={() => navigate('/librarian/requests')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <div className="divide-y divide-gray-50">
            {(d?.recentRequests ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-8 text-center">No pending requests</p>
            ) : (d?.recentRequests ?? []).map((r: { id: number; book: { title: string; availableCopies: number }; member: { user: { name: string } }; requestDate: string }) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.book?.title}</p>
                  <p className="text-xs text-gray-400">{r.member?.user?.name} · {format(new Date(r.requestDate), 'dd MMM yyyy')}</p>
                </div>
                <span className={`badge flex-shrink-0 ml-3 ${r.book?.availableCopies > 0 ? 'badge-green' : 'badge-red'}`}>
                  {r.book?.availableCopies > 0 ? 'Available' : 'Unavailable'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue Loans */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Overdue Books</h3>
            <button onClick={() => navigate('/librarian/overdue')} className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <div className="divide-y divide-gray-50">
            {(d?.overdueList ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-8 text-center">No overdue books 🎉</p>
            ) : (d?.overdueList ?? []).map((l: { id: number; bookCopy: { book: { title: string } }; member: { user: { name: string; email: string } }; dueDate: string }) => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{l.bookCopy?.book?.title}</p>
                  <p className="text-xs text-gray-400">{l.member?.user?.name}</p>
                </div>
                <span className="badge-red flex-shrink-0 ml-3">Due {format(new Date(l.dueDate), 'dd MMM')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
