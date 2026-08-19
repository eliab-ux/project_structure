'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
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
 * Navegação lateral — **só o trabalho do dia**.
 *
 * Cada item entra junto com a fase que o construiu: item de menu que leva a uma tela vazia ensina o
 * usuário a não confiar no menu.
 *
 * Configuração e perfil NÃO estão aqui. Eles moram no cabeçalho, e a separação é de frequência de
 * uso: a barra lateral é percorrida com os olhos dezenas de vezes por dia, e cada linha que não é
 * trabalho corrente aumenta o custo de achar a que é. Cadastrar máquina ou trocar a própria senha
 * acontece uma vez por mês.
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
];

/** O que vive atrás da engrenagem: o que se ajusta, não o que se opera. */
const SETTINGS: NavItem[] = [
  { href: '/configuracao', label: 'Configuração da conta', allow: ['owner'] },
  { href: '/contas', label: 'Contas e categorias', allow: ['admin', 'owner'] },
  { href: '/equipe', label: 'Equipe' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [openPreOrders, setOpenPreOrders] = useState(0);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const [userAnchor, setUserAnchor] = useState<null | HTMLElement>(null);

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

  const permitido = (item: NavItem) => !item.allow || (user && item.allow.includes(user.role));
  const groups = NAV.map((group) => ({
    ...group,
    items: group.items.filter(permitido),
  })).filter((group) => group.items.length > 0);
  const settings = SETTINGS.filter(permitido);

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
        <Typography variant="h3" component="p" sx={{ px: 2, pb: 1.5 }}>
          Kortex
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
                    // Faixa laranja no item ativo. `borderLeft` transparente no inativo mantém os
                    // dois com a mesma largura — senão o texto pula 3px ao trocar de tela.
                    borderLeft: '3px solid',
                    borderLeftColor: active ? 'error.main' : 'transparent',
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
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        {/*
         * Cabeçalho: engrenagem e identidade, sempre no mesmo lugar.
         *
         * Aparece nas duas larguras. No celular ele também carrega o nome do sistema, porque a
         * barra lateral some — sem isso não haveria como sair nem chegar ao perfil.
         */}
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: { xs: 2, md: 3 },
            py: 1.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="h3" component="p" sx={{ display: { xs: 'block', md: 'none' } }}>
            Kortex
          </Typography>
          <Box sx={{ flexGrow: 1 }} />

          {settings.length > 0 && (
            <>
              <Tooltip title="Configuração">
                <IconButton
                  aria-label="Configuração"
                  aria-haspopup="menu"
                  aria-expanded={Boolean(settingsAnchor)}
                  onClick={(event) => setSettingsAnchor(event.currentTarget)}
                  sx={{ color: 'text.secondary' }}
                >
                  <SettingsOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={settingsAnchor}
                open={Boolean(settingsAnchor)}
                onClose={() => setSettingsAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {settings.map((item) => (
                  <MenuItem
                    key={item.href}
                    component={Link}
                    href={item.href}
                    selected={pathname === item.href}
                    onClick={() => setSettingsAnchor(null)}
                  >
                    <ListItemText primaryTypographyProps={{ fontSize: 14 }}>
                      {item.label}
                    </ListItemText>
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

          <Button
            aria-haspopup="menu"
            aria-expanded={Boolean(userAnchor)}
            onClick={(event) => setUserAnchor(event.currentTarget)}
            endIcon={<ExpandMoreIcon />}
            variant="text"
            sx={{
              color: 'text.primary',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 13.5,
              px: 1,
            }}
          >
            <Box sx={{ textAlign: 'right', lineHeight: 1.15 }}>
              {user?.name}
              <Box
                component="span"
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  fontFamily: FONT_MONO,
                  fontSize: 10,
                  fontWeight: 400,
                  color: 'text.secondary',
                }}
              >
                {user ? USER_ROLE_LABELS[user.role] : ''}
              </Box>
            </Box>
          </Button>
          <Menu
            anchorEl={userAnchor}
            open={Boolean(userAnchor)}
            onClose={() => setUserAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              component={Link}
              href="/perfil"
              selected={pathname === '/perfil'}
              onClick={() => setUserAnchor(null)}
            >
              <ListItemText primaryTypographyProps={{ fontSize: 14 }}>Meu perfil</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setUserAnchor(null);
                signOut();
              }}
            >
              <ListItemText primaryTypographyProps={{ fontSize: 14, color: 'error.main' }}>
                Sair
              </ListItemText>
            </MenuItem>
          </Menu>
        </Box>

        <Box sx={{ p: { xs: 2, md: 3 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
