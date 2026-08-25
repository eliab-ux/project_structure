'use client';

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { adminAuthService } from '@/services/auth/adminAuthService';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AdminAuthContextValue {
  loading: boolean;
  user: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'kazaTemAdminAuth';

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed.user ?? null);
        setAccessToken(parsed.accessToken ?? null);
        setRefreshToken(parsed.refreshToken ?? null);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && accessToken && refreshToken) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, accessToken, refreshToken }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user, accessToken, refreshToken]);

  async function login(email: string, password: string) {
    const result = await adminAuthService.login({ email, password });
    setUser(result.user);
    setAccessToken(result.accessToken);
    setRefreshToken(result.refreshToken);
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }

  const value = useMemo(
    () => ({ loading, user, accessToken, refreshToken, login, logout }),
    [loading, user, accessToken, refreshToken],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuthContext() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuthContext must be used within AdminAuthProvider');
  }
  return context;
}
