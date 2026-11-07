import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
  trend?: string;
}

export default function StatsCard({ title, value, icon: Icon, color, subtitle, trend }: Props) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        {trend && <p className="text-xs text-emerald-600 mt-1 font-medium">{trend}</p>}
      </div>
    </div>
  );
}
