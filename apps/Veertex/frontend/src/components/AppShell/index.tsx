'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from 'src/contexts/AuthContext';
import { MESA } from 'src/constants/routes';

/**
 * As telas de ADMINISTRAÇÃO DA CONTA. Não são módulos, e a distinção decide o menu.
 *
 * O menu de módulos da Visão Geral (§2.1) é `plano ∩ conta ∩ papel`, e duas dessas três coisas —
 * catálogo de módulos e ativação por conta — chegam na F2. Empresas, usuários e papéis não passam
 * por esse cruzamento: existem em toda conta, independentemente de plano ou módulo contratado, e
 * uma conta sem eles não tem como operar nada. Por isso ficam aqui, fixos, e o menu dirigido por
 * módulo entra ao lado quando a F2 for integrada — sem substituir estes.
 *
 * `permission` esconde o item de quem não pode usá-lo. É conveniência de interface, nunca
 * segurança: quem decide é o `PermissionGuard` no backend. Esconder só evita oferecer um caminho
 * que terminaria em 403.
 */
const ADMIN_NAV = [
  { href: MESA, label: 'Mesa', permission: null },
  { href: '/companies', label: 'Empresas', permission: 'companies.read' },
  { href: '/users', label: 'Usuários', permission: 'users.read' },
  { href: '/roles', label: 'Papéis', permission: 'roles.read' },
  // Módulos é tela de CONFIGURAÇÃO DA CONTA, não de módulo — por isso entra aqui, fixa, e não no
  // menu derivado de `plano ∩ conta ∩ papel`. Ela é justamente onde esse cruzamento se administra:
  // um menu que sumisse ao desligar módulos tiraria o caminho de voltar a ligá-los.
  // `account.read` e não `account.update`: ver a configuração não é alterá-la (esconder não é
  // proteger — quem só lê continua vendo, com os controles inertes e explicados).
  { href: '/modules', label: 'Módulos', permission: 'account.read' },
] as const;

/**
 * NAVEGAÇÃO CONTEXTUAL (§3), e o comportamento é o ponto da tese.
 *
 * A barra de telas **não aparece na Mesa** — lá o operador diz o que quer, não escolhe onde ir. Ela
 * aparece quando ele está DENTRO de uma tela, para poder voltar e para se localizar. `Esc` volta para
 * a Mesa de qualquer lugar.
 *
 * A barra é FIXA (telas CORE), e não derivada de `plano ∩ conta ∩ papel`. O §3 é explícito: derivada é
 * a PROPOSTA, não a navegação. Desligar VND não tira Empresas do menu; tira o pedido das propostas
 * da Mesa.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, account, role, signOut, can } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const onMesa = pathname === MESA;
  const visibleNav = ADMIN_NAV.filter((item) => !item.permission || can(item.permission));

  /**
   * `Esc` volta para a Mesa de qualquer tela (§3).
   *
   * Não intercepta na própria Mesa: lá o `Esc` pertence ao rascunho, que o usa para descartar. Dois
   * significados para a mesma tecla no mesmo lugar seria pior do que nenhum atalho.
   */
  useEffect(() => {
    if (onMesa) {
      return undefined;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        router.push(MESA);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMesa, router]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} color="primary">
        <Toolbar component="nav" aria-label="Barra principal">
          <Typography variant="h6" component="span" sx={{ fontWeight: 700, mr: 2 }}>
            Veertex
          </Typography>

          {account ? (
            <Chip
              label={account.name}
              size="small"
              sx={{ bgcolor: 'primary.dark', color: 'primary.contrastText' }}
            />
          ) : null}

          <Stack
            direction="row"
            spacing={0.5}
            sx={{ ml: 3, display: { xs: 'none', md: onMesa ? 'none' : 'flex' } }}
          >
            {visibleNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Button
                  key={item.href}
                  component={NextLink}
                  href={item.href}
                  color="inherit"
                  size="small"
                  aria-current={active ? 'page' : undefined}
                  sx={{
                    fontWeight: active ? 700 : 400,
                    // Sublinhado, e não só o negrito: peso de fonte sozinho é uma diferença que
                    // passa despercebida e que ninguém enxerga em monocromático.
                    borderBottom: active ? '2px solid currentColor' : '2px solid transparent',
                    borderRadius: 0,
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
            {user?.name}
            {role ? ` · ${role.name}` : ''}
          </Typography>

          <IconButton
            onClick={(event) => setAnchorEl(event.currentTarget)}
            aria-label="Menu do usuário"
            size="small"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </Avatar>
          </IconButton>

          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            {/* Em telas estreitas a barra some, e o menu do usuário passa a ser o único caminho para
                as outras páginas — inclusive de volta à Mesa. Sem isto, o celular ficaria preso na
                tela em que entrou, porque `Esc` não existe em teclado virtual. */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              {visibleNav.map((item) => (
                <MenuItem
                  key={item.href}
                  component={NextLink}
                  href={item.href}
                  onClick={() => setAnchorEl(null)}
                >
                  {item.label}
                </MenuItem>
              ))}
              <Divider />
            </Box>

            <MenuItem
              onClick={() => {
                setAnchorEl(null);
                signOut();
              }}
            >
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              Sair
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ p: { xs: 2, sm: 3 } }}>
        {children}
      </Box>
    </Box>
  );
}
