import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode; }

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-400" />
      </div>
      <p className="text-gray-700 font-medium">{title}</p>
      {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
