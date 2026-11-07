import React from 'react';

const map: Record<string, string> = {
  ACTIVE: 'badge-green',
  RETURNED: 'badge-blue',
  OVERDUE: 'badge-red',
  LOST: 'badge-gray',
  PENDING: 'badge-yellow',
  APPROVED: 'badge-green',
  REJECTED: 'badge-red',
  CANCELLED: 'badge-gray',
  FULFILLED: 'badge-blue',
  EXPIRED: 'badge-gray',
  AVAILABLE: 'badge-green',
  ISSUED: 'badge-blue',
  RESERVED: 'badge-yellow',
  MAINTENANCE: 'badge-gray',
  SUSPENDED: 'badge-red',
  INACTIVE: 'badge-gray',
  GOOD: 'badge-green',
  DAMAGED: 'badge-yellow',
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}
