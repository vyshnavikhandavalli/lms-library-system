import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Auth pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

// Layouts
import AdminLayout from '@/layouts/AdminLayout';
import LibrarianLayout from '@/layouts/LibrarianLayout';
import MemberLayout from '@/layouts/MemberLayout';

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminBooks from '@/pages/admin/Books';
import AdminCategories from '@/pages/admin/Categories';
import AdminMembers from '@/pages/admin/Members';
import AdminLoans from '@/pages/admin/Loans';
import AdminFines from '@/pages/admin/Fines';
import AdminReports from '@/pages/admin/Reports';
import AdminSettings from '@/pages/admin/Settings';

// Librarian pages
import LibrarianDashboard from '@/pages/librarian/Dashboard';
import LibrarianBooks from '@/pages/librarian/Books';
import LibrarianMembers from '@/pages/librarian/Members';
import LibrarianRequests from '@/pages/librarian/BorrowRequests';
import LibrarianLoans from '@/pages/librarian/Loans';
import LibrarianFines from '@/pages/librarian/Fines';
import LibrarianOverdue from '@/pages/librarian/Overdue';

// Member pages
import MemberDashboard from '@/pages/member/Dashboard';
import MemberCatalogue from '@/pages/member/Catalogue';
import MemberMyLoans from '@/pages/member/MyLoans';
import MemberReservations from '@/pages/member/Reservations';
import MemberFines from '@/pages/member/Fines';
import MemberNotifications from '@/pages/member/Notifications';

function RoleRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'LIBRARIAN') return <Navigate to="/librarian/dashboard" replace />;
  return <Navigate to="/member/dashboard" replace />;
}

function RequireAuth({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<RoleRedirect />} />

          {/* Admin */}
          <Route path="/admin" element={<RequireAuth roles={['ADMIN']}><AdminLayout /></RequireAuth>}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="books" element={<AdminBooks />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="loans" element={<AdminLoans />} />
            <Route path="fines" element={<AdminFines />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Librarian */}
          <Route path="/librarian" element={<RequireAuth roles={['ADMIN', 'LIBRARIAN']}><LibrarianLayout /></RequireAuth>}>
            <Route path="dashboard" element={<LibrarianDashboard />} />
            <Route path="books" element={<LibrarianBooks />} />
            <Route path="members" element={<LibrarianMembers />} />
            <Route path="requests" element={<LibrarianRequests />} />
            <Route path="loans" element={<LibrarianLoans />} />
            <Route path="fines" element={<LibrarianFines />} />
            <Route path="overdue" element={<LibrarianOverdue />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Member */}
          <Route path="/member" element={<RequireAuth roles={['MEMBER']}><MemberLayout /></RequireAuth>}>
            <Route path="dashboard" element={<MemberDashboard />} />
            <Route path="catalogue" element={<MemberCatalogue />} />
            <Route path="my-loans" element={<MemberMyLoans />} />
            <Route path="reservations" element={<MemberReservations />} />
            <Route path="fines" element={<MemberFines />} />
            <Route path="notifications" element={<MemberNotifications />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
