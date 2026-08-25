'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ACCESS_TOKEN_KEY,
  USER_KEY,
  clearSession,
  getStoredToken,
  storeSession,
} from 'src/services/api';
import { authService } from 'src/services/services';
import type { AuthAccount, AuthUser } from 'src/types/api';

/** The pair as it is cached and rendered. The API always hands them together. */
interface CachedSession {
  user: AuthUser;
  account: AuthAccount;
}

interface AuthContextValue {
  user: AuthUser | null;
  /**
   * The tenant. Separate from `user` because the API keeps them separate — folding the account name
   * into the user is what made the shell render `undefined` where the gabinete's name should be.
   */
  account: AuthAccount | null;
  /** True until the stored session has been read — screens wait on this before redirecting. */
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The signed-in user, from localStorage and confirmed against the API.
 *
 * The `loading` flag matters more than it looks: without it every protected page renders once with
 * `user === null` and bounces to /login before the session is read, so a page refresh would log the
 * operator out. Screens must wait for `loading === false` before deciding anything.
 *
 * The stored user is trusted for RENDERING only. Every authorisation decision is the backend's — a role
 * edited in localStorage changes which menu items appear and nothing else, because each request is
 * checked server-side against the JWT.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getStoredToken(ACCESS_TOKEN_KEY);
    const stored = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null;

    if (!token || !stored) {
      setLoading(false);
      return;
    }

    // Render immediately from the cached user, then confirm with the API. The optimistic render is what
    // keeps a refresh from flashing a loading screen on every navigation.
    try {
      const cached = JSON.parse(stored) as CachedSession;
      setUser(cached.user);
      setAccount(cached.account);
    } catch {
      clearSession();
    }

    authService
      .me()
      .then((fresh) => {
        // `/auth/me` answers `{ user, account }`. Assigning the whole envelope to `user` — as this did
        // before — left `user.role` undefined, so after any page refresh an ACCOUNT_ADMIN silently
        // stopped being treated as one by the interface.
        setUser(fresh.user);
        setAccount(fresh.account);
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      })
      .catch(() => {
        // A 401 already triggered the interceptor's refresh-or-redirect. Anything else (offline, API
        // down) leaves the cached user in place: bouncing someone to /login because the network blinked
        // would be worse than letting them see a stale screen.
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await authService.login(email, password);
    // Cache the pair, in the same shape `/auth/me` returns, so the optimistic render on the next page
    // load reads exactly what the confirmation will overwrite.
    const cached: CachedSession = { user: session.user, account: session.account };
    storeSession(session.accessToken, session.refreshToken, cached);
    setUser(session.user);
    setAccount(session.account);
    return session.user;
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
    setAccount(null);
    router.push('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      account,
      loading,
      isAdmin: user?.role === 'ACCOUNT_ADMIN',
      signIn,
      signOut,
    }),
    [user, account, loading, signIn, signOut],
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
