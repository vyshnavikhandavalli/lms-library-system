import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Users, ClipboardList,
  BookMarked, AlertCircle, DollarSign, LogOut, Menu, X, Library
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import NotificationBell from '@/components/NotificationBell';

const navLinks = [
  { to: '/librarian/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/librarian/books', label: 'Books', icon: BookOpen },
  { to: '/librarian/members', label: 'Members', icon: Users },
  { to: '/librarian/requests', label: 'Borrow Requests', icon: ClipboardList },
  { to: '/librarian/loans', label: 'Loans', icon: BookMarked },
  { to: '/librarian/overdue', label: 'Overdue', icon: AlertCircle },
  { to: '/librarian/fines', label: 'Fines', icon: DollarSign },
];

export default function LibrarianLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => { await logout(); toast.success('Logged out'); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className={`${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 bg-emerald-900 text-white flex flex-col transition-all duration-200`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-emerald-700">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Library size={16} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">LibraryMS</p>
              <p className="text-emerald-300 text-xs">Librarian</p>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)} className="ml-auto p-1 rounded hover:bg-emerald-700 flex-shrink-0">
            {collapsed ? <Menu size={14} /> : <X size={14} />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-emerald-600 text-white' : 'text-emerald-100 hover:bg-emerald-800 hover:text-white'}`
              }>
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-emerald-700">
          {!collapsed && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-emerald-300 truncate">{user?.email}</p>
            </div>
          )}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-emerald-100 hover:bg-emerald-800 transition-colors">
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <h1 className="text-base font-semibold text-gray-700">Librarian Panel</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6"><Outlet /></main>
      </div>
    </div>
  );
}
