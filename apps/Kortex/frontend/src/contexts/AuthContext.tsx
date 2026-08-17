'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from 'src/services/authService';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_KEY,
  clearSession,
  getStoredToken,
  storeSession,
} from 'src/services/api';
import { AuthenticatedUser, homePathFor } from 'src/types/auth';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthenticatedUser>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Restaura a sessão no primeiro render e CONFERE com o servidor.
   *
   * O usuário do localStorage serve para pintar a tela sem piscar, mas não é fonte de verdade:
   * quem foi desligado às 14h não pode continuar vendo o painel porque o navegador dele guardou um
   * objeto antigo. O `/auth/me` é a palavra final.
   */
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
    if (stored) {
      try {
        setUser(JSON.parse(stored) as AuthenticatedUser);
      } catch {
        clearSession();
      }
    }

    if (!getStoredToken(ACCESS_TOKEN_KEY)) {
      setLoading(false);
      return;
    }

    authService
      .me()
      .then((fresh) => {
        setUser(fresh);
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await authService.login(email, password);
    storeSession(session.accessToken, session.refreshToken, session.user);
    setUser(session.user);
    return session.user;
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    if (!getStoredToken(REFRESH_TOKEN_KEY)) {
      return;
    }
    const fresh = await authService.me();
    setUser(fresh);
    localStorage.setItem(USER_KEY, JSON.stringify(fresh));
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refreshUser }),
    [user, loading, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa estar dentro de AuthProvider.');
  }
  return context;
}

export { homePathFor };
