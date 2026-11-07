import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { booksApi, categoriesApi, borrowRequestsApi, reservationsApi } from '@/lib/api';
import { Search, BookOpen, Send, Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';

export default function MemberCatalogue() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [availability, setAvailability] = useState('');
  const [detailBook, setDetailBook] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['books-catalogue', page, search, categoryId, availability],
    queryFn: () => booksApi.list({ page, limit: 12, search, ...(categoryId && { categoryId }), ...(availability && { availability }) }),
  });

  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const categories = catData?.data ?? [];

  const borrowMut = useMutation({
    mutationFn: (bookId: number) => borrowRequestsApi.create({ bookId }),
    onSuccess: () => { toast.success('Borrow request submitted!'); qc.invalidateQueries({ queryKey: ['dashboard', 'member'] }); setDetailBook(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Request failed'),
  });

  const reserveMut = useMutation({
    mutationFn: (bookId: number) => reservationsApi.create({ bookId }),
    onSuccess: () => { toast.success('Reservation placed successfully!'); setDetailBook(null); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'),
  });

  const books = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">Browse Books</h1><p className="text-gray-500 text-sm">Search and borrow from the library catalog</p></div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search title, author, ISBN..." className="input pl-9" />
        </div>
        <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }} className="input w-44">
          <option value="">All Categories</option>
          {categories.map((c: { id: number; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={availability} onChange={e => { setAvailability(e.target.value); setPage(1); }} className="input w-36">
          <option value="">All Books</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {/* Books Grid */}
      {isLoading ? <div className="py-16 text-center text-gray-400 text-sm">Loading catalog...</div> :
        books.length === 0 ? <EmptyState icon={BookOpen} title="No books found" description="Try adjusting your search or filters" /> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {books.map((b: Record<string, unknown>) => {
                const avail = b.availableCopies as number;
                return (
                  <div key={b.id as number} onClick={() => setDetailBook(b)}
                    className="card p-4 cursor-pointer hover:shadow-md transition-shadow hover:border-blue-200">
                    <div className="w-full h-32 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center mb-3">
                      <BookOpen size={32} className="text-blue-400" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm truncate">{b.title as string}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{b.author as string}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{(b.category as { name: string })?.name}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`badge text-xs ${avail > 0 ? 'badge-green' : 'badge-red'}`}>
                        {avail > 0 ? `${avail} available` : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {pagination && <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} limit={12} onPageChange={setPage} />}
          </>
        )}

      {/* Book Detail Modal */}
      <Modal isOpen={!!detailBook} onClose={() => setDetailBook(null)} title="Book Details">
        {detailBook && (
          <div className="space-y-4">
            <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
              <BookOpen size={48} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{detailBook.title as string}</h2>
              <p className="text-gray-500 text-sm mt-0.5">by {detailBook.author as string}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-400">ISBN</p><p className="font-medium font-mono text-xs">{detailBook.isbn as string}</p></div>
              <div><p className="text-gray-400">Category</p><p className="font-medium">{(detailBook.category as { name: string })?.name}</p></div>
              <div><p className="text-gray-400">Publisher</p><p className="font-medium">{(detailBook.publisher as string) || '—'}</p></div>
              <div><p className="text-gray-400">Year</p><p className="font-medium">{(detailBook.publicationYear as number) || '—'}</p></div>
              <div><p className="text-gray-400">Shelf</p><p className="font-medium">{(detailBook.shelfLocation as string) || '—'}</p></div>
              <div><p className="text-gray-400">Available</p>
                <span className={`badge ${(detailBook.availableCopies as number) > 0 ? 'badge-green' : 'badge-red'}`}>
                  {detailBook.availableCopies as number}/{detailBook.totalCopies as number}
                </span>
              </div>
            </div>
            {detailBook.description ? <p className="text-sm text-gray-600 leading-relaxed">{String(detailBook.description)}</p> : null}
            <div className="flex gap-3 pt-2">
              {(detailBook.availableCopies as number) > 0 ? (
                <button onClick={() => borrowMut.mutate(detailBook.id as number)} disabled={borrowMut.isPending}
                  className="btn-primary flex-1 justify-center">
                  <Send size={14} /> {borrowMut.isPending ? 'Submitting...' : 'Request to Borrow'}
                </button>
              ) : (
                <button onClick={() => reserveMut.mutate(detailBook.id as number)} disabled={reserveMut.isPending}
                  className="btn-secondary flex-1 justify-center">
                  <Bookmark size={14} /> {reserveMut.isPending ? 'Reserving...' : 'Reserve Book'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
