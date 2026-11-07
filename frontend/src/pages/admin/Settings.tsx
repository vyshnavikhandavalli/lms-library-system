import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api';
import { Settings, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.list });
  const settings: Array<{ key: string; value: string; description?: string }> = data?.data ?? [];
  const [edits, setEdits] = useState<Record<string, string>>({});

  const updateMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => settingsApi.update(key, value),
    onSuccess: () => { toast.success('Setting saved'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => toast.error('Failed to save'),
  });

  const getValue = (key: string, fallback: string) => edits[key] !== undefined ? edits[key] : fallback;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg"><Settings size={20} className="text-blue-600" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900">Library Settings</h1><p className="text-gray-500 text-sm">Configure system behaviour</p></div>
      </div>

      <div className="card divide-y divide-gray-100">
        {isLoading ? <p className="text-sm text-gray-400 text-center py-10">Loading settings...</p> :
          settings.map(s => (
            <div key={s.key} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{s.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type={s.key.includes('days') || s.key.includes('rate') || s.key.includes('per') || s.key.includes('max') ? 'number' : 'text'}
                  value={getValue(s.key, s.value)}
                  onChange={e => setEdits(prev => ({ ...prev, [s.key]: e.target.value }))}
                  className="input w-28 text-right"
                  min="0"
                />
                <button
                  onClick={() => { if (edits[s.key] !== undefined && edits[s.key] !== s.value) updateMut.mutate({ key: s.key, value: edits[s.key] }); }}
                  disabled={edits[s.key] === undefined || edits[s.key] === s.value || updateMut.isPending}
                  className="btn-primary btn-sm disabled:opacity-30">
                  <Save size={12} /> Save
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
