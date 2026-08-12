'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import authService from 'src/services/authService';
import { clearSession, getStoredToken, storeSession, ACCESS_TOKEN_KEY } from 'src/services/api';
import { AuthAccount, AuthRole, AuthUser } from 'src/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  account: AuthAccount | null;
  role: AuthRole | null;
  permissions: string[];
  /** `plano ∩ conta` — vem do token, resolvido no login/refresh. */
  modules: string[];
  /** True while the session is being restored on first paint — not "a request is running". */
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): void;
  /** Mirrors the backend's `grants()`: exact match, area wildcard, or the global `*`. */
  can(permission: string): boolean;
  /** Se a conta tem o módulo ativo. Decide o que RENDERIZAR — o backend decide o que é permitido. */
  hasModule(code: string): boolean;
  /**
   * Renova o access token e recarrega a sessão.
   *
   * Existe por causa do toggle de módulos: os módulos efetivos viajam no token, então mudá-los sem
   * renovar deixaria o administrador olhando o menu antigo na própria tela em que acabou de mexer.
   */
  refreshSession(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Whether a set of granted permissions satisfies a required one.
 *
 * Deliberately the same algorithm as the backend's `grants()`, prefix by prefix rather than a
 * `startsWith`: `contacts.credit_limit.*` must grant `contacts.credit_limit.edit` and NOT
 * `contacts.delete`. This copy only decides what to RENDER — the backend decides what is allowed,
 * and hiding a button is never the security control.
 */
function grants(granted: string[], permission: string): boolean {
  if (granted.includes('*') || granted.includes(permission)) {
    return true;
  }
  const segments = permission.split('.');
  for (let i = 1; i < segments.length; i += 1) {
    if (granted.includes(`${segments.slice(0, i).join('.')}.*`)) {
      return true;
    }
  }
  return false;
}

/**
 * ⚠️ Não há decodificação de JWT aqui, e a ausência é deliberada.
 *
 * Uma versão anterior lia o claim `modules` do access token, decodificando o payload em base64 sem
 * verificar assinatura. Era defensável — o navegador não tem a chave, e o valor só decide o que
 * desenhar. Mas o `/auth/me` passou a expor `modules` no corpo, e aí a decodificação virou a pior das
 * duas opções: o frontend passa a conhecer o formato interno do token, e conhecer significa que trocar
 * o claim quebra a tela sem nada avisar.
 *
 * A fonte é a resposta da API — a mesma que traz usuário, conta e papel.
 */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [role, setRole] = useState<AuthRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Restores the session from the stored token by asking the API who it belongs to, instead of
   * trusting a user object cached in localStorage: a role changed while the tab was closed would
   * otherwise render yesterday's menu.
   */
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!getStoredToken(ACCESS_TOKEN_KEY)) {
        setLoading(false);
        return;
      }
      try {
        const me = await authService.me();
        if (cancelled) {
          return;
        }
        setUser(me.user);
        setAccount(me.account);
        setRole(me.role);
        setPermissions(me.role?.permissions ?? []);
        setModules(me.modules ?? []);
      } catch {
        // The axios interceptor already redirects on an unrecoverable 401; anything else means the
        // session is unusable and the safe state is "signed out".
        clearSession();
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    storeSession(result.accessToken, result.refreshToken, result.user);
    setUser(result.user);
    setPermissions(result.permissions);
    setModules(result.modules);

    // The login response carries the user and permissions but not the account/role detail the
    // shell renders, so `me` fills them in. One extra round trip, once per sign-in.
    const me = await authService.me();
    setAccount(me.account);
    setRole(me.role);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
    setAccount(null);
    setRole(null);
    setPermissions([]);
    setModules([]);
    router.replace('/login');
  }, [router]);

  const can = useCallback((permission: string) => grants(permissions, permission), [permissions]);

  const hasModule = useCallback((code: string) => modules.includes(code), [modules]);

  /**
   * Força a renovação do token e recarrega `me`. Chamado após o toggle de módulos.
   *
   * Usa o mesmo endpoint de refresh do interceptor, mas de forma deliberada em vez de reativa — o
   * interceptor só renova em resposta a um 401, e aqui o token atual continua válido; o que está
   * desatualizado é o conteúdo dele.
   */
  const refreshSession = useCallback(async () => {
    await authService.refresh();
    const me = await authService.me();
    setUser(me.user);
    setAccount(me.account);
    setRole(me.role);
    setPermissions(me.role?.permissions ?? []);
    setModules(me.modules ?? []);
  }, []);

  const value = useMemo(
    () => ({
      user,
      account,
      role,
      permissions,
      modules,
      loading,
      signIn,
      signOut,
      can,
      hasModule,
      refreshSession,
    }),
    [
      user,
      account,
      role,
      permissions,
      modules,
      loading,
      signIn,
      signOut,
      can,
      hasModule,
      refreshSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  }
  return context;
}
