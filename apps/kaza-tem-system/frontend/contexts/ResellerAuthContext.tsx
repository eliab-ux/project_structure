'use client';

import { ReactNode, createContext, useContext, useMemo } from 'react';
import { AuthContextValue, useAuthContext } from '@/contexts/AuthContext';
import { AuthLoginResponse } from '@/services/auth/authService';

export interface ResellerAuthContextValue extends Omit<AuthContextValue, 'login'> {
  login(email: string, password: string): Promise<AuthLoginResponse>;
  isReseller: boolean;
}

const ResellerAuthContext = createContext<ResellerAuthContextValue | undefined>(undefined);

export function ResellerAuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthContext();

  const value = useMemo<ResellerAuthContextValue>(() => {
    const login = async (email: string, password: string) => {
      const result = await auth.login(email, password);
      if (!result.reseller) {
        throw new Error('Este usuário não possui um cadastro de revendedor ativo.');
      }
      return result;
    };

    return {
      ...auth,
      login,
      isReseller: Boolean(auth.reseller && auth.user?.role === 'reseller'),
    };
  }, [auth]);

  return <ResellerAuthContext.Provider value={value}>{children}</ResellerAuthContext.Provider>;
}

export function useResellerAuth() {
  const context = useContext(ResellerAuthContext);
  if (!context) {
    throw new Error('useResellerAuth must be used within ResellerAuthProvider');
  }
  return context;
}
