import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { Bell, CheckCheck, BookOpen, AlertCircle, CheckCircle, DollarSign, Bookmark, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const iconMap: Record<string, React.ReactNode> = {
  BORROW_REQUEST: <BookOpen size={16} className="text-blue-500" />,
  APPROVED: <CheckCircle size={16} className="text-green-500" />,
  REJECTED: <XCircle size={16} className="text-red-500" />,
  ISSUED: <BookOpen size={16} className="text-indigo-500" />,
  DUE_REMINDER: <AlertCircle size={16} className="text-amber-500" />,
  OVERDUE: <AlertCircle size={16} className="text-red-500" />,
  RESERVATION_READY: <Bookmark size={16} className="text-purple-500" />,
  FINE_GENERATED: <DollarSign size={16} className="text-red-500" />,
  FINE_PAID: <DollarSign size={16} className="text-green-500" />,
};

export default function MemberNotifications() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
  });

  const readAllMut = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  const readMut = useMutation({
    mutationFn: notificationsApi.read,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications: Array<{
    id: number; type: string; title: string; message: string; isRead: boolean; createdAt: string;
  }> = data?.data?.notifications ?? [];
  const unread: number = data?.data?.unreadCount ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 text-sm">
            {unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={() => readAllMut.mutate()} className="btn-secondary btn-sm">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="card divide-y divide-gray-50">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => { if (!n.isRead) readMut.mutate(n.id); }}
              className={`px-5 py-4 flex items-start gap-4 cursor-pointer transition-colors hover:bg-gray-50 ${!n.isRead ? 'bg-blue-50 hover:bg-blue-50/70' : ''}`}
            >
              <div className={`mt-0.5 p-2 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-white shadow-sm' : 'bg-gray-100'}`}>
                {iconMap[n.type] ?? <Bell size={16} className="text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {n.title}
                </p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1.5">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
              {!n.isRead && (
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
