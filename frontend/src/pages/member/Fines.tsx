import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { finesApi } from '@/lib/api';
import { AlertCircle, CheckCircle } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { format } from 'date-fns';

export default function MemberFines() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-fines'],
    queryFn: finesApi.my,
  });

  const fines: Array<Record<string, unknown>> = data?.data?.fines ?? [];
  const totalOutstanding: number = data?.data?.totalOutstanding ?? 0;

  const unpaid = fines.filter(f => !f.isPaid);
  const paid = fines.filter(f => f.isPaid);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Fines</h1>
        <p className="text-gray-500 text-sm">Outstanding and cleared fines on your account</p>
      </div>

      {/* Outstanding banner */}
      {totalOutstanding > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
          <AlertCircle size={22} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Outstanding Fine: ₹{totalOutstanding.toFixed(2)}</p>
            <p className="text-sm text-red-600 mt-0.5">
              Please visit the library counter to clear your dues. Unpaid fines may restrict borrowing.
            </p>
          </div>
        </div>
      )}

      {totalOutstanding === 0 && fines.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-700 font-medium">All fines cleared — your account is in good standing.</p>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading fines...</div>
      ) : fines.length === 0 ? (
        <EmptyState icon={CheckCircle} title="No fines on your account" description="Keep returning books on time to stay fine-free!" />
      ) : (
        <div className="space-y-4">
          {/* Unpaid */}
          {unpaid.length > 0 && (
            <div className="card">
              <div className="px-5 py-3 border-b border-gray-100 bg-red-50">
                <h3 className="font-semibold text-red-800 text-sm">Unpaid Fines ({unpaid.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {unpaid.map(f => <FineRow key={f.id as number} fine={f} />)}
              </div>
            </div>
          )}

          {/* Paid */}
          {paid.length > 0 && (
            <div className="card">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-700 text-sm">Payment History ({paid.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {paid.map(f => <FineRow key={f.id as number} fine={f} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FineRow({ fine }: { fine: Record<string, unknown> }) {
  const bookTitle = (fine.loan as { bookCopy: { book: { title: string } } })?.bookCopy?.book?.title;
  return (
    <div className="px-5 py-3 flex items-center justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 truncate">{bookTitle}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="badge-yellow text-xs">{fine.fineType as string}</span>
          {(fine.daysOverdue as number) > 0 && (
            <span className="text-xs text-gray-400">{fine.daysOverdue as number} days overdue</span>
          )}
          <span className="text-xs text-gray-400">
            {format(new Date(fine.generatedAt as string), 'dd MMM yyyy')}
          </span>
        </div>
      </div>
      <div className="text-right ml-4 flex-shrink-0">
        <p className={`font-semibold ${fine.isPaid ? 'text-gray-400 line-through' : 'text-red-600'}`}>
          ₹{(fine.amount as number).toFixed(2)}
        </p>
        {fine.isPaid ? (
          <span className="badge-green text-xs">Paid</span>
        ) : (
          <span className="badge-red text-xs">Unpaid</span>
        )}
      </div>
    </div>
  );
}
