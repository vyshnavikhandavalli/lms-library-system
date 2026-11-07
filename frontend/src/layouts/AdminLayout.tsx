import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Tag, Users, BookMarked,
  AlertCircle, BarChart2, Settings, LogOut, Bell, Menu, X, Library
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import NotificationBell from '@/components/NotificationBell';

const navLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/books', label: 'Books', icon: BookOpen },
  { to: '/admin/categories', label: 'Categories', icon: Tag },
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/loans', label: 'Loans', icon: BookMarked },
  { to: '/admin/fines', label: 'Fines', icon: AlertCircle },
  { to: '/admin/reports', label: 'Reports', icon: BarChart2 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-60'} flex-shrink-0 bg-slate-900 text-white flex flex-col transition-all duration-200`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Library size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">LibraryMS</p>
              <p className="text-slate-400 text-xs">Admin Panel</p>
            </div>
          )}
          <button onClick={() => setCollapsed(c => !c)} className="ml-auto p-1 rounded hover:bg-slate-700 flex-shrink-0">
            {collapsed ? <Menu size={14} /> : <X size={14} />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              }>
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          {!collapsed && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          )}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <h1 className="text-base font-semibold text-gray-700">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
