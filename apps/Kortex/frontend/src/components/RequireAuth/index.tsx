'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from 'src/contexts/AuthContext';
import { UserRole, homePathFor } from 'src/types/auth';

interface RequireAuthProps {
  children: React.ReactNode;
  /** Papéis que podem ver esta área. Omitido = qualquer usuário autenticado. */
  allow?: UserRole[];
}

/**
 * Porteiro das áreas autenticadas.
 *
 * Isto é conveniência de navegação, **não** segurança: quem decide o que cada papel pode fazer é o
 * guard do backend, e é ele que responde 401/403. Esconder um botão no navegador não protege
 * endpoint nenhum — o valor aqui é não mostrar ao Modelista uma tela que só lhe daria erro.
 *
 * Enquanto `mustChangePassword` estiver de pé, tudo leva para a troca de senha: uma senha
 * escolhida por terceiro é uma senha que duas pessoas conhecem.
 */
export function RequireAuth({ children, allow }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.mustChangePassword && pathname !== '/trocar-senha') {
      router.replace('/trocar-senha');
      return;
    }
    if (allow && !allow.includes(user.role)) {
      router.replace(homePathFor(user.role));
    }
  }, [user, loading, allow, pathname, router]);

  const blocked =
    loading ||
    !user ||
    (user.mustChangePassword && pathname !== '/trocar-senha') ||
    (allow && !allow.includes(user.role));

  if (blocked) {
    return (
      <Box
        role="status"
        aria-label="Carregando"
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}
