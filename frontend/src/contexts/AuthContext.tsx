import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { authApi } from '@/lib/api';

export type UserRole = 'ADMIN' | 'LIBRARIAN' | 'MEMBER';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  member?: { id: number; memberCode: string; status: string; maxBooksAllowed: number };
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    const { accessToken, refreshToken, user: userData } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authApi.me();
      const userData = res.data;
      localStorage.setItem('user', JSON.stringify({ id: userData.id, name: userData.name, email: userData.email, role: userData.role }));
      setUser({ id: userData.id, name: userData.name, email: userData.email, role: userData.role, member: userData.member });
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
