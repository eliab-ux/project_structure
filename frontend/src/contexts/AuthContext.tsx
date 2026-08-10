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
 * Lê os módulos efetivos do payload do access token.
 *
 * O backend não expõe os módulos em `/auth/me` — eles são um claim do token, resolvido na emissão.
 * Ler daqui evita uma rota a mais e mantém uma fonte só: o mesmo valor que o `ModuleGuard` usa do
 * outro lado.
 *
 * Decodifica SEM verificar assinatura, e isso é correto aqui: o navegador não tem — nem deve ter —
 * a chave. O conteúdo serve apenas para decidir o que desenhar; toda decisão que importa é
 * reverificada no servidor, com a assinatura conferida.
 */
function readModulesFromToken(): string[] {
  const token = getStoredToken(ACCESS_TOKEN_KEY);
  if (!token) {
    return [];
  }
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { modules?: unknown };
    return Array.isArray(claims.modules)
      ? claims.modules.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    // Token malformado: sem módulo nenhum. O menu encolhe, e a próxima requisição de verdade
    // recebe 401 e manda para o login — nunca o contrário, que seria abrir o que não deve.
    return [];
  }
}

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
        setModules(readModulesFromToken());
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
    setModules(readModulesFromToken());
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
