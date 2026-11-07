import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertCircle } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { format } from 'date-fns';

export default function AdminReports() {
  const trends = useQuery({ queryKey: ['reports', 'trends'], queryFn: reportsApi.borrowingTrends });
  const popular = useQuery({ queryKey: ['reports', 'popular'], queryFn: reportsApi.popularBooks });
  const overdue = useQuery({ queryKey: ['reports', 'overdue'], queryFn: reportsApi.overdueSummary });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1><p className="text-gray-500 text-sm">Library usage insights</p></div>

      {/* Borrowing Trends */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Monthly Borrowing Trend (Last 6 Months)</h3>
        {trends.isLoading ? <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Loading...</div> :
          (trends.data?.data ?? []).length === 0 ? <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data available</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trends.data?.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Loans" />
              </BarChart>
            </ResponsiveContainer>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Books */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Most Borrowed Books</h3>
          {popular.isLoading ? <p className="text-sm text-gray-400 text-center py-8">Loading...</p> :
            (popular.data?.data ?? []).length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No data</p> : (
              <div className="space-y-2">
                {(popular.data?.data ?? []).map((b: { title: string; author: string; loan_count: number }, i: number) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{b.title}</p>
                      <p className="text-xs text-gray-400">{b.author}</p>
                    </div>
                    <span className="badge-blue flex-shrink-0">{b.loan_count} loans</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Overdue Summary */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" /> Overdue Summary
          </h3>
          {overdue.isLoading ? <p className="text-sm text-gray-400 text-center py-8">Loading...</p> :
            (overdue.data?.data ?? []).length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No overdue loans 🎉</p> : (
              <div className="space-y-2">
                {(overdue.data?.data ?? []).slice(0, 8).map((l: { id: number; bookCopy: { book: { title: string } }; member: { user: { name: string } }; dueDate: string; daysOverdue: number }) => (
                  <div key={l.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{l.bookCopy?.book?.title}</p>
                      <p className="text-xs text-gray-400">{l.member?.user?.name} · Due {format(new Date(l.dueDate), 'dd MMM yyyy')}</p>
                    </div>
                    <span className="badge-red flex-shrink-0">{l.daysOverdue}d late</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
