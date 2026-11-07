import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Search, BookOpen, Bookmark,
  AlertCircle, Bell, LogOut, Library
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import NotificationBell from '@/components/NotificationBell';

const navLinks = [
  { to: '/member/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/member/catalogue', label: 'Browse Books', icon: Search },
  { to: '/member/my-loans', label: 'My Loans', icon: BookOpen },
  { to: '/member/reservations', label: 'Reservations', icon: Bookmark },
  { to: '/member/fines', label: 'My Fines', icon: AlertCircle },
  { to: '/member/notifications', label: 'Notifications', icon: Bell },
];

export default function MemberLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); toast.success('Logged out'); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="w-60 flex-shrink-0 bg-violet-900 text-white flex flex-col">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-violet-700">
          <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Library size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">LibraryMS</p>
            <p className="text-violet-300 text-xs">Member Portal</p>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-violet-600 text-white' : 'text-violet-100 hover:bg-violet-800 hover:text-white'}`
              }>
              <Icon size={16} className="flex-shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-violet-700">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-violet-300 truncate">{user?.email}</p>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-violet-100 hover:bg-violet-800 transition-colors">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-gray-500">Welcome back, <span className="font-semibold text-gray-800">{user?.name}</span></p>
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-6"><Outlet /></main>
      </div>
    </div>
  );
}
