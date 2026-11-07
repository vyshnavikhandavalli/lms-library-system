import { PrismaClient, Role, MemberStatus, CopyCondition, CopyStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Library Settings ────────────────────────────────────
  const settings = [
    { key: 'loan_duration_days', value: '14', description: 'Default loan duration in days' },
    { key: 'fine_per_day', value: '5', description: 'Fine amount per overdue day (₹)' },
    { key: 'max_books_per_member', value: '3', description: 'Maximum books a member can borrow at once' },
    { key: 'reservation_expiry_days', value: '3', description: 'Days before a reservation expires after notification' },
    { key: 'max_renewals', value: '2', description: 'Maximum loan renewals allowed' },
  ];

  for (const s of settings) {
    await prisma.librarySetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log('✅ Settings seeded');

  // ── Categories ──────────────────────────────────────────
  const categories = [
    { name: 'Computer Science', description: 'Programming, algorithms, software engineering' },
    { name: 'Mathematics', description: 'Pure and applied mathematics' },
    { name: 'Physics', description: 'Classical and modern physics' },
    { name: 'Chemistry', description: 'Organic, inorganic and physical chemistry' },
    { name: 'Biology', description: 'Life sciences and biotechnology' },
    { name: 'History', description: 'World and regional history' },
    { name: 'Literature', description: 'Fiction, non-fiction and poetry' },
    { name: 'Economics', description: 'Micro and macroeconomics' },
    { name: 'Engineering', description: 'Mechanical, civil, electrical engineering' },
    { name: 'Reference', description: 'Encyclopedias, dictionaries, atlases' },
  ];

  const createdCategories: Record<string, number> = {};
  for (const cat of categories) {
    const c = await prisma.bookCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    createdCategories[cat.name] = c.id;
  }
  console.log('✅ Categories seeded');

  // ── Admin User ───────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@library.edu' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@library.edu',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      isActive: true,
    },
  });
  console.log('✅ Admin user seeded  →  admin@library.edu / Admin@123');

  // ── Librarian Users ──────────────────────────────────────
  const librarianPassword = await bcrypt.hash('Librarian@123', 12);
  const librarian1 = await prisma.user.upsert({
    where: { email: 'librarian@library.edu' },
    update: {},
    create: {
      name: 'Sarah Mitchell',
      email: 'librarian@library.edu',
      passwordHash: librarianPassword,
      role: Role.LIBRARIAN,
      isActive: true,
    },
  });
  console.log('✅ Librarian seeded  →  librarian@library.edu / Librarian@123');

  // ── Member Users ─────────────────────────────────────────
  const memberPassword = await bcrypt.hash('Member@123', 12);

  const memberData = [
    { name: 'Alice Johnson', email: 'alice@student.edu', code: 'MEM001' },
    { name: 'Bob Williams', email: 'bob@student.edu', code: 'MEM002' },
    { name: 'Carol Davis', email: 'carol@student.edu', code: 'MEM003' },
    { name: 'David Martinez', email: 'david@student.edu', code: 'MEM004' },
    { name: 'Emma Wilson', email: 'emma@student.edu', code: 'MEM005' },
  ];

  for (const md of memberData) {
    const user = await prisma.user.upsert({
      where: { email: md.email },
      update: {},
      create: {
        name: md.name,
        email: md.email,
        passwordHash: memberPassword,
        role: Role.MEMBER,
        isActive: true,
      },
    });
    await prisma.member.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        memberCode: md.code,
        maxBooksAllowed: 3,
        status: MemberStatus.ACTIVE,
      },
    });
  }
  console.log('✅ Members seeded  →  e.g. alice@student.edu / Member@123');

  // ── Books & Copies ───────────────────────────────────────
  const booksData = [
    {
      title: 'Introduction to Algorithms',
      isbn: '978-0262033848',
      author: 'Cormen, Leiserson, Rivest, Stein',
      publisher: 'MIT Press',
      category: 'Computer Science',
      year: 2022,
      copies: 4,
      shelf: 'CS-A1',
      description: 'Comprehensive introduction to modern algorithms.',
    },
    {
      title: 'Clean Code',
      isbn: '978-0132350884',
      author: 'Robert C. Martin',
      publisher: 'Prentice Hall',
      category: 'Computer Science',
      year: 2008,
      copies: 3,
      shelf: 'CS-A2',
      description: 'Best practices for writing readable and maintainable software.',
    },
    {
      title: 'Design Patterns',
      isbn: '978-0201633610',
      author: 'Gang of Four',
      publisher: 'Addison-Wesley',
      category: 'Computer Science',
      year: 1994,
      copies: 2,
      shelf: 'CS-B1',
      description: 'Reusable object-oriented software design patterns.',
    },
    {
      title: 'Calculus: Early Transcendentals',
      isbn: '978-1285741550',
      author: 'James Stewart',
      publisher: 'Cengage Learning',
      category: 'Mathematics',
      year: 2015,
      copies: 5,
      shelf: 'MATH-A1',
      description: 'Comprehensive calculus textbook for science and engineering students.',
    },
    {
      title: 'Linear Algebra and Its Applications',
      isbn: '978-0321982384',
      author: 'David C. Lay',
      publisher: 'Pearson',
      category: 'Mathematics',
      year: 2015,
      copies: 4,
      shelf: 'MATH-B1',
      description: 'Modern linear algebra with applications.',
    },
    {
      title: 'University Physics',
      isbn: '978-0135159552',
      author: 'Young & Freedman',
      publisher: 'Pearson',
      category: 'Physics',
      year: 2019,
      copies: 6,
      shelf: 'PHY-A1',
      description: 'Standard undergraduate physics textbook.',
    },
    {
      title: 'Organic Chemistry',
      isbn: '978-0321971371',
      author: 'Paula Yurkanis Bruice',
      publisher: 'Pearson',
      category: 'Chemistry',
      year: 2016,
      copies: 4,
      shelf: 'CHEM-A1',
      description: 'Complete organic chemistry for undergraduates.',
    },
    {
      title: 'Sapiens: A Brief History of Humankind',
      isbn: '978-0062316097',
      author: 'Yuval Noah Harari',
      publisher: 'Harper',
      category: 'History',
      year: 2015,
      copies: 3,
      shelf: 'HIST-A1',
      description: 'A sweeping history of the human species.',
    },
    {
      title: 'Principles of Economics',
      isbn: '978-0357038314',
      author: 'N. Gregory Mankiw',
      publisher: 'Cengage',
      category: 'Economics',
      year: 2020,
      copies: 5,
      shelf: 'ECON-A1',
      description: 'The leading introductory economics textbook.',
    },
    {
      title: 'Engineering Mechanics: Statics',
      isbn: '978-0133915426',
      author: 'Hibbeler',
      publisher: 'Pearson',
      category: 'Engineering',
      year: 2016,
      copies: 4,
      shelf: 'ENG-A1',
      description: 'Classical statics for engineering students.',
    },
  ];

  for (const b of booksData) {
    const existing = await prisma.book.findUnique({ where: { isbn: b.isbn } });
    if (!existing) {
      const book = await prisma.book.create({
        data: {
          title: b.title,
          isbn: b.isbn,
          author: b.author,
          publisher: b.publisher,
          categoryId: createdCategories[b.category],
          publicationYear: b.year,
          description: b.description,
          shelfLocation: b.shelf,
          totalCopies: b.copies,
          availableCopies: b.copies,
          createdById: admin.id,
        },
      });

      // Create individual physical copies
      for (let i = 1; i <= b.copies; i++) {
        const suffix = String(i).padStart(3, '0');
        await prisma.bookCopy.create({
          data: {
            bookId: book.id,
            copyCode: `${b.isbn}-${suffix}`,
            condition: CopyCondition.GOOD,
            status: CopyStatus.AVAILABLE,
          },
        });
      }
    }
  }
  console.log('✅ Books and copies seeded');

  console.log('\n🎉 Database seeded successfully!');
  console.log('─────────────────────────────────────');
  console.log('Login credentials:');
  console.log('  Admin     → admin@library.edu      / Admin@123');
  console.log('  Librarian → librarian@library.edu  / Librarian@123');
  console.log('  Member    → alice@student.edu       / Member@123');
  console.log('─────────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
