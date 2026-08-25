'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authService, AuthLoginResponse } from '@/services/auth/authService';

const STORAGE_KEY = 'kazaTemAuth';

export interface AuthContextValue {
  user: AuthLoginResponse['user'] | null;
  reseller: AuthLoginResponse['reseller'] | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login(email: string, password: string): Promise<AuthLoginResponse>;
  refreshTokens(): Promise<AuthLoginResponse>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persistState(payload: AuthLoginResponse | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!payload) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadStoredState(): AuthLoginResponse | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as AuthLoginResponse;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthLoginResponse['user'] | null>(null);
  const [reseller, setReseller] = useState<AuthLoginResponse['reseller'] | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const setAuthState = useCallback((payload: AuthLoginResponse) => {
    setUser(payload.user);
    setReseller(payload.reseller ?? null);
    setAccessToken(payload.accessToken);
    setRefreshToken(payload.refreshToken);
    persistState(payload);
    return payload;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setReseller(null);
    setAccessToken(null);
    setRefreshToken(null);
    persistState(null);
  }, []);

  const login = useCallback(
    (email: string, password: string) => authService.login({ email, password }).then(setAuthState),
    [setAuthState],
  );

  const refreshTokens = useCallback(async () => {
    if (!refreshToken) {
      throw new Error('Token de atualização indisponível');
    }
    const result = await authService.refresh(refreshToken);
    return setAuthState(result);
  }, [refreshToken, setAuthState]);

  useEffect(() => {
    const stored = loadStoredState();
    if (!stored) {
      setIsInitialized(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        await authService.refresh(stored.refreshToken).then((result) => {
          if (!cancelled) {
            setAuthState(result);
          }
        });
      } catch {
        if (!cancelled) {
          logout();
        }
      } finally {
        if (!cancelled) {
          setIsInitialized(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logout, setAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      reseller,
      accessToken,
      refreshToken,
      isAuthenticated: Boolean(user),
      isInitialized,
      login,
      refreshTokens,
      logout,
    }),
    [user, reseller, accessToken, refreshToken, isInitialized, login, refreshTokens, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
