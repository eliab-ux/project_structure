'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { useAuth } from 'src/contexts/AuthContext';
import preOrderService from 'src/services/preOrderService';
import { USER_ROLE_LABELS, UserRole } from 'src/types/auth';
import { FONT_MONO } from 'src/theme/theme';

interface NavItem {
  href: string;
  label: string;
  allow?: UserRole[];
  /** Marca o item que exibe contagem de pendência ao lado do nome. */
  badge?: 'preOrders';
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Navegação do painel — **só o que já existe**.
 *
 * Cada item entra junto com a fase que o construiu: item de menu que leva a uma tela vazia ensina o
 * usuário a não confiar no menu.
 */
const NAV: NavGroup[] = [
  {
    title: 'Operação',
    items: [
      { href: '/agenda', label: 'Agenda' },
      { href: '/pre-pedidos', label: 'Pré-pedidos', badge: 'preOrders' },
      { href: '/fila-de-espera', label: 'Fila de espera' },
    ],
  },
  {
    // Nenhum item aqui aparece para o Modelista: a §5 é explícita, ele não vê valor em dinheiro.
    // O `allow` é conveniência de navegação — quem barra de verdade é o `AdminGuard` no backend.
    title: 'Financeiro',
    items: [
      { href: '/lancamentos', label: 'Lançamentos', allow: ['admin', 'owner'] },
      { href: '/dre', label: 'DRE', allow: ['admin', 'owner'] },
      { href: '/contas', label: 'Contas e categorias', allow: ['admin', 'owner'] },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { href: '/clientes', label: 'Clientes' },
      { href: '/tecidos', label: 'Tecidos' },
      { href: '/produtos', label: 'Produtos' },
    ],
  },
  {
    title: 'Conta',
    items: [
      { href: '/configuracao', label: 'Configuração', allow: ['owner'] },
      { href: '/equipe', label: 'Equipe' },
      { href: '/perfil', label: 'Meu perfil' },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [openPreOrders, setOpenPreOrders] = useState(0);

  /**
   * Pré-pedidos abertos esperando reserva — a fila que o Administrativo precisa ver sem procurar.
   *
   * Recarrega a cada navegação em vez de ficar consultando por tempo. O pré-pedido chega quando o
   * Modelista termina de conversar com o cliente, não a cada 30 segundos; um `setInterval` traria
   * uma requisição por minuto por aba aberta o dia inteiro para uma contagem que muda poucas vezes
   * ao dia. Trocar de tela já é o momento natural de reconferir.
   */
  const loadBadge = useCallback(async () => {
    if (!user || user.role === 'modelista') {
      return;
    }
    try {
      setOpenPreOrders((await preOrderService.listOpenPreOrders()).length);
    } catch {
      // Contador é acessório: se falhar, o menu continua funcionando sem número. Mostrar erro de
      // um badge atrapalharia quem está tentando fazer outra coisa.
      setOpenPreOrders(0);
    }
  }, [user]);

  useEffect(() => {
    void loadBadge();
  }, [loadBadge, pathname]);

  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.allow || (user && item.allow.includes(user.role))),
  })).filter((group) => group.items.length > 0);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        component="nav"
        aria-label="Navegação principal"
        sx={{
          width: 194,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          py: 2,
          display: { xs: 'none', md: 'block' },
        }}
      >
        <Typography variant="h3" component="p" sx={{ px: 2 }}>
          Kortex
        </Typography>
        <Typography
          component="p"
          sx={{ px: 2, pb: 1.5, color: 'text.secondary', fontSize: 11, fontFamily: FONT_MONO }}
        >
          {user?.name}
          <br />
          {user ? USER_ROLE_LABELS[user.role] : ''}
        </Typography>
        <Divider />

        {groups.map((group) => (
          <Box key={group.title} sx={{ mt: 1.5 }}>
            <Typography variant="overline" component="p" sx={{ px: 2, color: 'text.secondary' }}>
              {group.title}
            </Typography>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Box
                  key={item.href}
                  component={Link}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    display: 'block',
                    px: 2,
                    py: 1,
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 500,
                    color: 'text.primary',
                    textDecoration: 'none',
                    bgcolor: active ? 'background.paper' : 'transparent',
                    boxShadow: active ? 'inset 3px 0 0 #F04E23' : 'none',
                  }}
                >
                  {item.label}
                  {item.badge === 'preOrders' && openPreOrders > 0 && (
                    <Box
                      component="span"
                      aria-label={`${openPreOrders} pré-pedidos aguardando reserva`}
                      sx={{
                        ml: 0.75,
                        fontFamily: FONT_MONO,
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'error.main',
                      }}
                    >
                      ({openPreOrders})
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}

        <Box sx={{ px: 2, mt: 3 }}>
          <Button variant="outlined" size="small" fullWidth onClick={signOut}>
            Sair
          </Button>
        </Box>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, minWidth: 0 }}>
        {/* Cabeçalho móvel: no celular a barra lateral some, e sem isto não haveria como sair. */}
        <Box
          component="header"
          sx={{
            display: { xs: 'flex', md: 'none' },
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h3" component="p">
            Kortex
          </Typography>
          <Button variant="outlined" size="small" onClick={signOut}>
            Sair
          </Button>
        </Box>
        {children}
      </Box>
    </Box>
  );
}
