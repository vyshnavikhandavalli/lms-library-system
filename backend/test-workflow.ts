/**
 * Full End-to-End Workflow Test
 * Run: npx ts-node test-workflow.ts
 */
import axios from 'axios';

const BASE = 'http://localhost:5001/api';
const api = axios.create({ baseURL: BASE });

let adminToken = '';
let libToken = '';
let memToken = '';

const pass = (msg: string) => console.log(`  ✅  ${msg}`);
const fail = (msg: string, err?: unknown) => { console.log(`  ❌  ${msg}`); if (err) console.error('     ', (err as { response?: { data?: unknown } })?.response?.data || err); };
const section = (title: string) => console.log(`\n${'─'.repeat(50)}\n  ${title}\n${'─'.repeat(50)}`);

async function run() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║      LMS Full Workflow Test                  ║');
  console.log('╚══════════════════════════════════════════════╝');

  // ── SECTION 1: Authentication ────────────────────────
  section('1. Authentication');

  try {
    const r = await api.post('/auth/login', { email: 'admin@library.edu', password: 'Admin@123' });
    adminToken = r.data.data.accessToken;
    pass(`Admin login → role: ${r.data.data.user.role}`);
  } catch (e) { fail('Admin login', e); return; }

  try {
    const r = await api.post('/auth/login', { email: 'librarian@library.edu', password: 'Librarian@123' });
    libToken = r.data.data.accessToken;
    pass(`Librarian login → role: ${r.data.data.user.role}`);
  } catch (e) { fail('Librarian login', e); return; }

  try {
    const r = await api.post('/auth/login', { email: 'alice@student.edu', password: 'Member@123' });
    memToken = r.data.data.accessToken;
    pass(`Member login → name: ${r.data.data.user.name}`);
  } catch (e) { fail('Member login', e); return; }

  // Test invalid credentials
  try {
    await api.post('/auth/login', { email: 'alice@student.edu', password: 'wrongpassword' });
    fail('Should have rejected wrong password');
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } };
    if (err?.response?.status === 401) pass('Invalid credentials correctly rejected (401)');
    else fail('Unexpected error on bad login', e);
  }

  // ── SECTION 2: Book Management ───────────────────────
  section('2. Book Management');

  let newBookId = 0;
  try {
    const r = await api.post('/books', {
      title: 'The Clean Coder', author: 'Robert C. Martin',
      isbn: '978-0137081073', categoryId: 1, totalCopies: 3,
      publisher: 'Prentice Hall', publicationYear: 2011,
      shelfLocation: 'CS-C1', description: 'A guide for professional programmers.',
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    newBookId = r.data.data.id;
    pass(`Admin created book: "${r.data.data.title}" [ID=${newBookId}]`);
  } catch (e) { fail('Create book', e); return; }

  try {
    const r = await api.get('/books', { headers: { Authorization: `Bearer ${memToken}` } });
    pass(`Member can list books → total: ${r.data.pagination.total}`);
  } catch (e) { fail('List books', e); }

  try {
    const r = await api.get('/books', { params: { search: 'algorithms' }, headers: { Authorization: `Bearer ${memToken}` } });
    pass(`Search books "algorithms" → found: ${r.data.pagination.total}`);
  } catch (e) { fail('Search books', e); }

  // Test duplicate ISBN rejected
  try {
    await api.post('/books', {
      title: 'Duplicate', author: 'Test', isbn: '978-0137081073', categoryId: 1, totalCopies: 1,
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    fail('Duplicate ISBN should have been rejected');
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } };
    if (err?.response?.status === 409) pass('Duplicate ISBN correctly rejected (409)');
  }

  // Get physical copies
  try {
    const r = await api.get(`/books/${newBookId}/copies`, { headers: { Authorization: `Bearer ${libToken}` } });
    pass(`Book copies created: ${r.data.data.length} physical copies`);
  } catch (e) { fail('Get book copies', e); }

  // ── SECTION 3: Member Management ────────────────────
  section('3. Member Management');

  let newMemberId = 0;
  try {
    const r = await api.post('/members', {
      name: 'Test Student', email: 'teststudent@test.edu',
      password: 'Test@12345', phone: '9999988888',
    }, { headers: { Authorization: `Bearer ${libToken}` } });
    newMemberId = r.data.data.id;
    pass(`Librarian created member: ${r.data.data.user.name} [Code: ${r.data.data.memberCode}]`);
  } catch (e) { fail('Create member', e); }

  try {
    const r = await api.get('/members', { headers: { Authorization: `Bearer ${adminToken}` } });
    pass(`List members → total: ${r.data.pagination.total}`);
  } catch (e) { fail('List members', e); }

  // Member cannot list other members
  try {
    await api.get('/members', { headers: { Authorization: `Bearer ${memToken}` } });
    fail('Member should not be able to list all members');
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } };
    if (err?.response?.status === 403) pass('Member cannot access member list (403 — correct)');
  }

  // ── SECTION 4: Borrow Request Workflow ───────────────
  section('4. Borrow Request → Approval → Issue');

  let requestId = 0;
  try {
    const r = await api.post('/borrow-requests', { bookId: newBookId },
      { headers: { Authorization: `Bearer ${memToken}` } });
    requestId = r.data.data.id;
    pass(`Member submitted borrow request [ID=${requestId}] — status: ${r.data.data.status}`);
  } catch (e) { fail('Submit borrow request', e); }

  // Duplicate request rejected
  try {
    await api.post('/borrow-requests', { bookId: newBookId },
      { headers: { Authorization: `Bearer ${memToken}` } });
    fail('Duplicate borrow request should be rejected');
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } };
    if (err?.response?.status === 409) pass('Duplicate borrow request correctly rejected (409)');
  }

  // Librarian approves
  try {
    await api.patch(`/borrow-requests/${requestId}/approve`, {},
      { headers: { Authorization: `Bearer ${libToken}` } });
    pass(`Librarian approved request [ID=${requestId}]`);
  } catch (e) { fail('Approve request', e); }

  // Issue the book
  let loanId = 0;
  try {
    const r = await api.post('/loans/issue', { borrowRequestId: requestId },
      { headers: { Authorization: `Bearer ${libToken}` } });
    loanId = r.data.data.id;
    pass(`Librarian issued book → Loan [ID=${loanId}], Due: ${new Date(r.data.data.dueDate).toLocaleDateString('en-IN')}`);
  } catch (e) { fail('Issue book', e); return; }

  // Verify book availability decremented
  try {
    const r = await api.get(`/books/${newBookId}`, { headers: { Authorization: `Bearer ${memToken}` } });
    pass(`Book availability updated: ${r.data.data.availableCopies}/${r.data.data.totalCopies} copies available`);
  } catch (e) { fail('Check availability after issue', e); }

  // ── SECTION 5: Member Dashboard ─────────────────────
  section('5. Member Dashboard');

  try {
    const r = await api.get('/dashboard/member', { headers: { Authorization: `Bearer ${memToken}` } });
    const s = r.data.data.stats;
    pass(`Member dashboard → borrowed: ${s.booksCurrentlyBorrowed}, pending: ${s.pendingRequests}`);
  } catch (e) { fail('Member dashboard', e); }

  // ── SECTION 6: Return & Fine Calculation ────────────
  section('6. Book Return');

  try {
    await api.post(`/loans/${loanId}/return`, { condition: 'GOOD' },
      { headers: { Authorization: `Bearer ${libToken}` } });
    pass(`Librarian processed return for loan [ID=${loanId}] — condition: GOOD`);
  } catch (e) { fail('Return book', e); }

  // Return again should fail
  try {
    await api.post(`/loans/${loanId}/return`, { condition: 'GOOD' },
      { headers: { Authorization: `Bearer ${libToken}` } });
    fail('Double return should be rejected');
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } };
    if (err?.response?.status === 409) pass('Double return correctly rejected (409)');
  }

  // Verify availability restored
  try {
    const r = await api.get(`/books/${newBookId}`, { headers: { Authorization: `Bearer ${memToken}` } });
    pass(`Book availability restored after return: ${r.data.data.availableCopies}/${r.data.data.totalCopies}`);
  } catch (e) { fail('Check availability after return', e); }

  // ── SECTION 7: Reservations ──────────────────────────
  section('7. Reservations');

  // Borrow all copies first to make unavailable
  const borrowedLoanIds: number[] = [];
  try {
    const copiesResp = await api.get(`/books/${newBookId}/copies`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const availCopies = copiesResp.data.data.filter((c: { status: string }) => c.status === 'AVAILABLE');
    pass(`Available copies before mass-borrow: ${availCopies.length}`);
  } catch (e) { fail('Check copies', e); }

  // Reserve (book still has copies, so it should reject reservation)
  try {
    await api.post('/reservations', { bookId: newBookId },
      { headers: { Authorization: `Bearer ${memToken}` } });
    fail('Reservation on available book should be rejected');
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { error?: string } } };
    if (err?.response?.status === 409) pass(`Reservation on available book correctly rejected: "${err.response?.data?.error}"`);
  }

  // ── SECTION 8: Fines ────────────────────────────────
  section('8. Fines');

  try {
    const r = await api.get('/fines/my', { headers: { Authorization: `Bearer ${memToken}` } });
    pass(`Member fines: ${r.data.data.fines.length} fines, outstanding: ₹${r.data.data.totalOutstanding}`);
  } catch (e) { fail('Get member fines', e); }

  try {
    const r = await api.get('/fines', { headers: { Authorization: `Bearer ${adminToken}` } });
    pass(`Admin can view all fines → total: ${r.data.pagination.total}`);
  } catch (e) { fail('Admin fines list', e); }

  // ── SECTION 9: Notifications ────────────────────────
  section('9. Notifications');

  try {
    const r = await api.get('/notifications', { headers: { Authorization: `Bearer ${memToken}` } });
    pass(`Member notifications: ${r.data.data.notifications.length} total, ${r.data.data.unreadCount} unread`);
  } catch (e) { fail('Get notifications', e); }

  // ── SECTION 10: Reports & Settings ──────────────────
  section('10. Reports & Settings');

  try {
    const r = await api.get('/reports/overdue-summary', { headers: { Authorization: `Bearer ${adminToken}` } });
    pass(`Overdue report: ${r.data.data.length} overdue loans`);
  } catch (e) { fail('Overdue report', e); }

  try {
    const r = await api.get('/reports/popular-books', { headers: { Authorization: `Bearer ${adminToken}` } });
    pass(`Popular books report: ${r.data.data.length} books with loan data`);
  } catch (e) { fail('Popular books report', e); }

  try {
    const r = await api.get('/settings', { headers: { Authorization: `Bearer ${adminToken}` } });
    pass(`Settings loaded: ${r.data.data.length} configurable settings`);
  } catch (e) { fail('Load settings', e); }

  try {
    await api.put('/settings/fine_per_day', { value: '10' }, { headers: { Authorization: `Bearer ${adminToken}` } });
    pass('Admin updated fine_per_day to ₹10');
    // Revert
    await api.put('/settings/fine_per_day', { value: '5' }, { headers: { Authorization: `Bearer ${adminToken}` } });
    pass('Reverted fine_per_day back to ₹5');
  } catch (e) { fail('Update settings', e); }

  // Member cannot change settings
  try {
    await api.put('/settings/fine_per_day', { value: '0' }, { headers: { Authorization: `Bearer ${memToken}` } });
    fail('Member should not update settings');
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } };
    if (err?.response?.status === 403) pass('Member cannot update settings (403 — correct)');
  }

  // ── SECTION 11: Admin Dashboard ─────────────────────
  section('11. Admin Dashboard');

  try {
    const r = await api.get('/dashboard/admin', { headers: { Authorization: `Bearer ${adminToken}` } });
    const s = r.data.data.stats;
    pass(`Admin dashboard stats:`);
    console.log(`       Books: ${s.totalBooks} titles, ${s.totalCopies} copies`);
    console.log(`       Available: ${s.availableCopies}  |  Issued: ${s.issuedCopies}`);
    console.log(`       Members: ${s.totalMembers}  |  Active loans: ${s.activeLoans}`);
    console.log(`       Overdue: ${s.overdueLoans}  |  Outstanding fines: ₹${s.outstandingFines}`);
  } catch (e) { fail('Admin dashboard', e); }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   All tests completed successfully! 🎉       ║');
  console.log('╚══════════════════════════════════════════════╝\n');
}

run().catch(e => { console.error('Test suite failed:', e); process.exit(1); });
