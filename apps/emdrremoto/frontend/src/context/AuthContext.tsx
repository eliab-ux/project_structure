'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from 'src/services/authService';
import { ACCESS_TOKEN_KEY } from 'src/services/api';
import { Psicologo } from 'src/types';

interface AuthContextValue {
  user: Psicologo | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Psicologo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (typeof window === 'undefined' || !sessionStorage.getItem(ACCESS_TOKEN_KEY)) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await authService.me());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, senha: string) => {
    const result = await authService.login(email, senha);
    setUser(result.psicologo);
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}
