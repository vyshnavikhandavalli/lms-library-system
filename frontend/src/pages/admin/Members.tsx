import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { membersApi } from '@/lib/api';
import { Plus, Pencil, Users, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';

export default function AdminMembers() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '', maxBooksAllowed: '3' });
  const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', status: 'ACTIVE', maxBooksAllowed: '3' });

  const { data, isLoading } = useQuery({
    queryKey: ['members', page, search],
    queryFn: () => membersApi.list({ page, limit: 10, search }),
  });

  const createMut = useMutation({
    mutationFn: membersApi.create,
    onSuccess: () => { toast.success('Member created'); qc.invalidateQueries({ queryKey: ['members'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => membersApi.update(id, data),
    onSuccess: () => { toast.success('Member updated'); qc.invalidateQueries({ queryKey: ['members'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const members = data?.data ?? [];
  const pagination = data?.pagination;

  const openEdit = (m: Record<string, unknown>) => {
    setSelected(m);
    setEditForm({ name: String((m.user as { name: string })?.name ?? ''), phone: String(m.phone ?? ''), address: String(m.address ?? ''), status: String(m.status ?? 'ACTIVE'), maxBooksAllowed: String(m.maxBooksAllowed ?? 3) });
    setModal('edit');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Members</h1><p className="text-gray-500 text-sm">Manage library members</p></div>
        <button onClick={() => { setForm({ name: '', email: '', password: '', phone: '', address: '', maxBooksAllowed: '3' }); setModal('add'); }} className="btn-primary"><Plus size={15} /> Add Member</button>
      </div>

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search name, email, code..." />
          <p className="text-sm text-gray-400">{pagination?.total ?? 0} members</p>
        </div>
        {isLoading ? <div className="py-16 text-center text-gray-400 text-sm">Loading...</div> :
          members.length === 0 ? <EmptyState icon={Users} title="No members found" /> : (
            <>
              <div className="table-container rounded-none border-0">
                <table className="table">
                  <thead><tr><th>Name</th><th>Email</th><th>Code</th><th>Status</th><th>Books Limit</th><th>Loans</th><th>Actions</th></tr></thead>
                  <tbody>
                    {members.map((m: Record<string, unknown>) => (
                      <tr key={m.id as number}>
                        <td className="font-medium">{(m.user as { name: string })?.name}</td>
                        <td className="text-gray-500 text-xs">{(m.user as { email: string })?.email}</td>
                        <td className="font-mono text-xs text-gray-500">{m.memberCode as string}</td>
                        <td><StatusBadge status={m.status as string} /></td>
                        <td className="text-center">{m.maxBooksAllowed as number}</td>
                        <td><span className="badge-blue">{(m._count as { loans: number })?.loans ?? 0}</span></td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setSelected(m); setModal('view'); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Eye size={14} /></button>
                            <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"><Pencil size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination && <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} limit={10} onPageChange={setPage} />}
            </>
          )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={modal === 'add'} onClose={() => setModal(null)} title="Add New Member">
        <form onSubmit={e => { e.preventDefault(); createMut.mutate({ ...form, maxBooksAllowed: parseInt(form.maxBooksAllowed) }); }} className="space-y-4">
          {(['name', 'email', 'password', 'phone', 'address'] as const).map(key => (
            <div key={key}>
              <label className="label capitalize">{key}{['name', 'email', 'password'].includes(key) ? ' *' : ''}</label>
              <input type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'} required={['name', 'email', 'password'].includes(key)} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className="input" />
            </div>
          ))}
          <div><label className="label">Max Books Allowed</label><input type="number" min="1" max="10" value={form.maxBooksAllowed} onChange={e => setForm(p => ({ ...p, maxBooksAllowed: e.target.value }))} className="input" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary">{createMut.isPending ? 'Creating...' : 'Create Member'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={modal === 'edit'} onClose={() => setModal(null)} title="Edit Member">
        <form onSubmit={e => { e.preventDefault(); updateMut.mutate({ id: selected?.id as number, data: { ...editForm, maxBooksAllowed: parseInt(editForm.maxBooksAllowed) } }); }} className="space-y-4">
          <div><label className="label">Name</label><input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="input" /></div>
          <div><label className="label">Phone</label><input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className="input" /></div>
          <div><label className="label">Address</label><input value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} className="input" /></div>
          <div><label className="label">Status</label>
            <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} className="input">
              <option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div><label className="label">Max Books Allowed</label><input type="number" min="1" max="10" value={editForm.maxBooksAllowed} onChange={e => setEditForm(p => ({ ...p, maxBooksAllowed: e.target.value }))} className="input" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={updateMut.isPending} className="btn-primary">{updateMut.isPending ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal isOpen={modal === 'view'} onClose={() => setModal(null)} title="Member Details" size="lg">
        {selected && <MemberDetail memberId={selected.id as number} />}
      </Modal>
    </div>
  );
}

function MemberDetail({ memberId }: { memberId: number }) {
  const { data, isLoading } = useQuery({ queryKey: ['member', memberId], queryFn: () => membersApi.get(memberId) });
  const m = data?.data;
  if (isLoading) return <p className="text-sm text-gray-400 text-center py-8">Loading...</p>;
  if (!m) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-gray-400">Name</p><p className="font-medium">{m.user?.name}</p></div>
        <div><p className="text-gray-400">Email</p><p className="font-medium">{m.user?.email}</p></div>
        <div><p className="text-gray-400">Member Code</p><p className="font-mono font-medium">{m.memberCode}</p></div>
        <div><p className="text-gray-400">Status</p><StatusBadge status={m.status} /></div>
        <div><p className="text-gray-400">Phone</p><p className="font-medium">{m.phone || '—'}</p></div>
        <div><p className="text-gray-400">Max Books</p><p className="font-medium">{m.maxBooksAllowed}</p></div>
      </div>
      {m.fines?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-red-600 mb-2">Outstanding Fines</p>
          {m.fines.map((f: { id: number; amount: number; fineType: string }) => (
            <div key={f.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
              <span className="text-gray-600">{f.fineType}</span>
              <span className="font-semibold text-red-600">₹{f.amount}</span>
            </div>
          ))}
        </div>
      )}
      {m.loans?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Recent Loans</p>
          {m.loans.slice(0, 5).map((l: { id: number; bookCopy: { book: { title: string } }; status: string; dueDate: string }) => (
            <div key={l.id} className="flex justify-between items-center text-sm py-1.5 border-b border-gray-50">
              <span className="text-gray-700 truncate max-w-[200px]">{l.bookCopy?.book?.title}</span>
              <StatusBadge status={l.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
