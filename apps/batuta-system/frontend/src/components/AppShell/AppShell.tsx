'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import SimCardIcon from '@mui/icons-material/SimCard';
import PeopleIcon from '@mui/icons-material/People';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ArticleIcon from '@mui/icons-material/Article';
import VerifiedIcon from '@mui/icons-material/VerifiedUser';
import SendIcon from '@mui/icons-material/Send';
import ForumIcon from '@mui/icons-material/Forum';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { useAuth } from 'src/contexts/AuthContext';

const DRAWER_WIDTH = 248;

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** True for screens that change controls rather than run operations. */
  adminOnly?: boolean;
}

/**
 * The navigation, in the order §11 (FASE 10) lists the screens.
 *
 * The order is the daily workflow and not an alphabet: channels before contacts because a contact needs a
 * sender; content before approval because you approve something that exists; distribution after both; and
 * the inbox last, because it is where you live after a campaign goes out.
 */
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Painel', icon: <DashboardIcon /> },
  { href: '/channels', label: 'Canais', icon: <SimCardIcon /> },
  { href: '/contacts', label: 'Contatos', icon: <PeopleIcon /> },
  { href: '/migrations', label: 'Migração de remetente', icon: <SwapHorizIcon /> },
  { href: '/contents', label: 'Conteúdo', icon: <ArticleIcon /> },
  { href: '/approvals', label: 'Aprovação', icon: <VerifiedIcon /> },
  { href: '/distributions', label: 'Distribuição', icon: <SendIcon /> },
  { href: '/inbox', label: 'Caixa de entrada', icon: <ForumIcon /> },
  { href: '/audit', label: 'Auditoria', icon: <FactCheckIcon />, adminOnly: true },
];

/**
 * The authenticated frame: navigation, the account name, and sign-out.
 *
 * It also guards. A page that renders inside this shell cannot be seen without a session, because the
 * shell itself redirects — which is a UI convenience rather than a security control: the real check is on
 * every request, and the API refuses without a valid JWT regardless of what the browser renders.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, account, loading, isAdmin, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Aberta por padrão no desktop: quem entra precisa ver para onde ir. Recolher é uma escolha de quem
  // quer a tela inteira para uma tabela larga — a de contatos e a de auditoria pedem isso.
  const [desktopOpen, setDesktopOpen] = useState(true);

  // Waiting on the stored session. Redirecting here would log out anyone who refreshed the page.
  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
        role="status"
        aria-label="Carregando sessão"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      router.replace('/login');
    }
    return null;
  }

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const navigation = (
    <Box component="nav" aria-label="Navegação principal">
      <Toolbar sx={{ px: 2 }}>
        <Box>
          <Typography variant="h6" component="p" sx={{ lineHeight: 1.1 }}>
            Batuta
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {account?.name ?? '—'}
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {items.map((item) => (
          <ListItemButton
            key={item.href}
            selected={pathname.startsWith(item.href)}
            onClick={() => {
              router.push(item.href);
              setMobileOpen(false);
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  // Largura que a navegação OCUPA no fluxo. Zero quando recolhida, e é ela que empurra tanto a barra
  // do topo quanto o conteúdo — uma única fonte para as duas, senão eles divergem.
  const railWidth = desktopOpen ? DRAWER_WIDTH : 0;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${railWidth}px)` },
          ml: { md: `${railWidth}px` },
          borderBottom: 1,
          borderColor: 'divider',
          transition: (theme) =>
            theme.transitions.create(['width', 'margin'], {
              duration: theme.transitions.duration.leavingScreen,
            }),
        }}
      >
        <Toolbar>
          <IconButton
            aria-label="Abrir menu"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          {/* Dois botões em vez de um com media query: o breakpoint decide no CSS, sem detecção em JS
              (que renderiza errado no primeiro frame e pisca). */}
          <Tooltip title={desktopOpen ? 'Recolher menu' : 'Expandir menu'}>
            <IconButton
              aria-label={desktopOpen ? 'Recolher menu' : 'Expandir menu'}
              aria-expanded={desktopOpen}
              edge="start"
              onClick={() => setDesktopOpen((open) => !open)}
              sx={{ mr: 2, display: { xs: 'none', md: 'inline-flex' } }}
            >
              <MenuIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="subtitle1" component="h1" sx={{ flexGrow: 1 }}>
            {items.find((item) => pathname.startsWith(item.href))?.label ?? 'Batuta'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            {user.name}
          </Typography>
          <Tooltip title="Sair">
            <IconButton onClick={signOut} aria-label="Sair">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {navigation}
      </Drawer>
      {/*
        A largura vai no ROOT do Drawer, não só no paper. O paper é `position: fixed`, então definir a
        largura apenas nele deixava o root com zero de largura: o `main`, irmão dele no flex, começava
        em x=0 e passava POR BAIXO da navegação — o conteúdo cortado à esquerda.

        `variant="persistent"` em vez de `permanent` para que `open` recolha de verdade, deslizando o
        paper para fora em vez de escondê-lo.
      */}
      <Drawer
        variant="persistent"
        open={desktopOpen}
        sx={{
          display: { xs: 'none', md: 'block' },
          width: railWidth,
          flexShrink: 0,
          transition: (theme) =>
            theme.transitions.create('width', {
              duration: theme.transitions.duration.leavingScreen,
            }),
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {navigation}
      </Drawer>

      <Box
        component="main"
        sx={{
          // Sem largura explícita: `flexGrow` já faz o conteúdo ocupar o que sobrou, e é o que o faz
          // crescer e encolher junto com a navegação. `minWidth: 0` é o que impede uma tabela larga
          // (contatos, auditoria) de esticar o flex e reintroduzir o corte.
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, md: 3 },
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
