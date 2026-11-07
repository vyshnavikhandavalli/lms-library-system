import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { booksApi, categoriesApi } from '@/lib/api';
import { Plus, Pencil, Trash2, BookOpen, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';

interface BookForm {
  title: string; isbn: string; author: string; publisher: string;
  categoryId: string; publicationYear: string; description: string;
  totalCopies: string; shelfLocation: string;
}

const EMPTY: BookForm = { title: '', isbn: '', author: '', publisher: '', categoryId: '', publicationYear: '', description: '', totalCopies: '1', shelfLocation: '' };

export default function AdminBooks() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<BookForm>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ['books', page, search],
    queryFn: () => booksApi.list({ page, limit: 10, search }),
  });

  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const categories = catData?.data ?? [];

  const createMut = useMutation({
    mutationFn: booksApi.create,
    onSuccess: () => { toast.success('Book added'); qc.invalidateQueries({ queryKey: ['books'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => booksApi.update(id, data),
    onSuccess: () => { toast.success('Book updated'); qc.invalidateQueries({ queryKey: ['books'] }); setModal(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const deleteMut = useMutation({
    mutationFn: booksApi.delete,
    onSuccess: () => { toast.success('Book deleted'); qc.invalidateQueries({ queryKey: ['books'] }); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Cannot delete'),
  });

  const openAdd = () => { setForm(EMPTY); setSelected(null); setModal('add'); };
  const openEdit = (b: Record<string, unknown>) => {
    setSelected(b);
    setForm({
      title: String(b.title ?? ''), isbn: String(b.isbn ?? ''), author: String(b.author ?? ''),
      publisher: String(b.publisher ?? ''), categoryId: String((b.category as { id: number })?.id ?? ''),
      publicationYear: String(b.publicationYear ?? ''), description: String(b.description ?? ''),
      totalCopies: String(b.totalCopies ?? 1), shelfLocation: String(b.shelfLocation ?? ''),
    });
    setModal('edit');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form, categoryId: parseInt(form.categoryId),
      totalCopies: parseInt(form.totalCopies),
      publicationYear: form.publicationYear ? parseInt(form.publicationYear) : undefined,
    };
    if (modal === 'add') createMut.mutate(payload);
    else if (modal === 'edit' && selected) updateMut.mutate({ id: selected.id as number, data: payload });
  };

  const handleDelete = (b: Record<string, unknown>) => {
    if (!window.confirm(`Delete "${b.title}"?`)) return;
    deleteMut.mutate(b.id as number);
  };

  const books = data?.data ?? [];
  const pagination = data?.pagination;

  const f = (key: keyof BookForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Books</h1>
          <p className="text-gray-500 text-sm">Manage book catalog and inventory</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Add Book</button>
      </div>

      <div className="card">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search title, author, ISBN..." />
          <p className="text-sm text-gray-400">{pagination?.total ?? 0} books</p>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading books...</div>
        ) : books.length === 0 ? (
          <EmptyState icon={BookOpen} title="No books found" description="Add your first book to the catalog" action={<button onClick={openAdd} className="btn-primary btn-sm">Add Book</button>} />
        ) : (
          <>
            <div className="table-container rounded-none border-0">
              <table className="table">
                <thead><tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th>Availability</th><th>Actions</th></tr></thead>
                <tbody>
                  {books.map((b: Record<string, unknown>) => {
                    const avail = b.availableCopies as number;
                    const total = b.totalCopies as number;
                    return (
                      <tr key={b.id as number}>
                        <td><p className="font-medium text-gray-900 truncate max-w-[180px]">{b.title as string}</p></td>
                        <td className="text-gray-600">{b.author as string}</td>
                        <td className="font-mono text-xs text-gray-500">{b.isbn as string}</td>
                        <td><span className="badge-purple">{(b.category as { name: string })?.name}</span></td>
                        <td>
                          <span className={`badge ${avail > 0 ? 'badge-green' : 'badge-red'}`}>{avail}/{total}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setSelected(b); setModal('view'); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" title="View copies"><Eye size={14} /></button>
                            <button onClick={() => openEdit(b)} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500" title="Edit"><Pencil size={14} /></button>
                            <button onClick={() => handleDelete(b)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pagination && <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} limit={10} onPageChange={setPage} />}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'add' ? 'Add New Book' : 'Edit Book'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">Title *</label><input required {...f('title')} className="input" /></div>
            <div><label className="label">ISBN *</label><input required {...f('isbn')} className="input" placeholder="978-..." /></div>
            <div><label className="label">Author *</label><input required {...f('author')} className="input" /></div>
            <div><label className="label">Publisher</label><input {...f('publisher')} className="input" /></div>
            <div>
              <label className="label">Category *</label>
              <select required {...f('categoryId')} className="input">
                <option value="">Select...</option>
                {categories.map((c: { id: number; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Publication Year</label><input type="number" {...f('publicationYear')} className="input" placeholder="2024" /></div>
            <div><label className="label">Total Copies *</label><input required type="number" min="1" {...f('totalCopies')} className="input" /></div>
            <div><label className="label">Shelf Location</label><input {...f('shelfLocation')} className="input" placeholder="e.g. CS-A1" /></div>
            <div className="col-span-2"><label className="label">Description</label><textarea rows={3} {...f('description')} className="input resize-none" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : modal === 'add' ? 'Add Book' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Copies Modal */}
      <Modal isOpen={modal === 'view'} onClose={() => setModal(null)} title={`Copies — ${selected?.title as string}`} size="lg">
        <CopiesView bookId={selected?.id as number} />
      </Modal>
    </div>
  );
}

function CopiesView({ bookId }: { bookId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['book-copies', bookId],
    queryFn: () => booksApi.copies(bookId),
    enabled: !!bookId,
  });
  const copies = data?.data ?? [];
  if (isLoading) return <p className="text-sm text-gray-400 text-center py-8">Loading...</p>;
  return (
    <table className="table w-full text-sm">
      <thead><tr><th>Copy Code</th><th>Condition</th><th>Status</th></tr></thead>
      <tbody>
        {copies.map((c: { id: number; copyCode: string; condition: string; status: string }) => (
          <tr key={c.id}>
            <td className="font-mono text-xs">{c.copyCode}</td>
            <td><StatusBadge status={c.condition} /></td>
            <td><StatusBadge status={c.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
