import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';

export default function AdminCategories() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<{ id: number; name: string; description?: string } | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const categories = data?.data ?? [];

  const createMut = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => { toast.success('Category created'); qc.invalidateQueries({ queryKey: ['categories'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => categoriesApi.update(id, data),
    onSuccess: () => { toast.success('Category updated'); qc.invalidateQueries({ queryKey: ['categories'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: categoriesApi.delete,
    onSuccess: () => { toast.success('Category deleted'); qc.invalidateQueries({ queryKey: ['categories'] }); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Cannot delete'),
  });

  const openAdd = () => { setForm({ name: '', description: '' }); setSelected(null); setModal('add'); };
  const openEdit = (c: { id: number; name: string; description?: string }) => {
    setSelected(c); setForm({ name: c.name, description: c.description ?? '' }); setModal('edit');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modal === 'add') createMut.mutate(form);
    else if (modal === 'edit' && selected) updateMut.mutate({ id: selected.id, data: form });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Categories</h1><p className="text-gray-500 text-sm">Manage book categories</p></div>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Add Category</button>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading...</div>
        ) : categories.length === 0 ? (
          <EmptyState icon={Tag} title="No categories yet" action={<button onClick={openAdd} className="btn-primary btn-sm">Add Category</button>} />
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Description</th><th>Books</th><th>Actions</th></tr></thead>
            <tbody>
              {categories.map((c: { id: number; name: string; description?: string; _count?: { books: number } }) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-gray-500">{c.description ?? '—'}</td>
                  <td><span className="badge-blue">{c._count?.books ?? 0} books</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"><Pencil size={14} /></button>
                      <button onClick={() => { if (window.confirm(`Delete "${c.name}"?`)) deleteMut.mutate(c.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modal !== null} onClose={() => setModal(null)} title={modal === 'add' ? 'Add Category' : 'Edit Category'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Name *</label><input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" /></div>
          <div><label className="label">Description</label><textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input resize-none" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
