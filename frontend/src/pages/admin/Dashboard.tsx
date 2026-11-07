import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import StatsCard from '@/components/ui/StatsCard';
import { BookOpen, Copy, Users, BookMarked, AlertCircle, Clock, DollarSign, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'admin'], queryFn: dashboardApi.admin });
  const d = data?.data;

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading dashboard...</div>;

  const stats = d?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Complete overview of library operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Books" value={stats?.totalBooks ?? 0} icon={BookOpen} color="bg-blue-500" subtitle="Unique titles" />
        <StatsCard title="Total Copies" value={stats?.totalCopies ?? 0} icon={Copy} color="bg-indigo-500" subtitle="Physical copies" />
        <StatsCard title="Available" value={stats?.availableCopies ?? 0} icon={BookOpen} color="bg-emerald-500" subtitle="Ready to issue" />
        <StatsCard title="Issued" value={stats?.issuedCopies ?? 0} icon={BookMarked} color="bg-amber-500" subtitle="Currently borrowed" />
        <StatsCard title="Members" value={stats?.totalMembers ?? 0} icon={Users} color="bg-sky-500" subtitle="Registered" />
        <StatsCard title="Active Loans" value={stats?.activeLoans ?? 0} icon={Clock} color="bg-orange-500" subtitle="Ongoing" />
        <StatsCard title="Pending Requests" value={stats?.pendingRequests ?? 0} icon={BarChart2} color="bg-purple-500" subtitle="Awaiting approval" />
        <StatsCard title="Overdue" value={stats?.overdueLoans ?? 0} icon={AlertCircle} color="bg-red-500" subtitle="Past due date" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Outstanding Fines */}
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-rose-500">
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Outstanding Fines</p>
            <p className="text-2xl font-bold text-gray-900">₹{stats?.outstandingFines?.toFixed(2) ?? '0.00'}</p>
            <p className="text-xs text-gray-400">Uncollected amount</p>
          </div>
        </div>

        {/* Borrowing Trend Chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Monthly Borrowing Trend</h3>
          {d?.monthlyLoans?.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={d.monthlyLoans}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="_count.id" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Loans" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No trend data yet</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Recent Activity</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {(d?.recentActivity ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 px-5 py-6 text-center">No recent activity</p>
          ) : (
            (d?.recentActivity ?? []).map((log: { id: number; action: string; entityType: string; actor: { name: string; role: string }; createdAt: string }) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-800">
                    <span className="font-medium">{log.actor?.name}</span>
                    <span className="text-gray-500 mx-1">·</span>
                    <span className="text-gray-600">{log.action.replace(/_/g, ' ')}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{log.entityType}</p>
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0 ml-4">
                  {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
