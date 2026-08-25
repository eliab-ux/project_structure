'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Badge,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PeopleIcon from '@mui/icons-material/People';
import PaymentsIcon from '@mui/icons-material/Payments';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import InventoryIcon from '@mui/icons-material/Inventory';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SettingsIcon from '@mui/icons-material/Settings';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminMetricsProvider, useAdminMetricsContext } from '@/contexts/AdminMetricsContext';

const menuItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  {
    href: '/admin/revendedores/pendentes',
    label: 'Aprovações',
    icon: <HourglassEmptyIcon fontSize="small" />,
    badgeKey: 'pendingRegistrations',
  },
  { href: '/admin/revendedores', label: 'Revendedores', icon: <PeopleIcon fontSize="small" /> },
  {
    href: '/admin/saques',
    label: 'Saques',
    icon: <PaymentsIcon fontSize="small" />,
    badgeKey: 'pendingWithdrawals',
  },
  { href: '/admin/pedidos', label: 'Pedidos', icon: <ShoppingBagIcon fontSize="small" /> },
  { href: '/admin/produtos', label: 'Produtos', icon: <InventoryIcon fontSize="small" /> },
  { href: '/admin/materiais', label: 'Materiais', icon: <PhotoLibraryIcon fontSize="small" /> },
  { href: '/admin/configuracoes', label: 'Configurações', icon: <SettingsIcon fontSize="small" /> },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminMetricsProvider>
        <AdminShell>{children}</AdminShell>
      </AdminMetricsProvider>
    </AdminAuthProvider>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAdminAuth();
  const { metrics } = useAdminMetricsContext();

  const badgeMap = {
    pendingRegistrations: metrics?.pendingRegistrations ?? 0,
    pendingWithdrawals: metrics?.pendingWithdrawals ?? 0,
  } as const;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f5f7' }}>
      <Box
        component="nav"
        sx={{
          width: 260,
          bgcolor: '#111827',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          px: 2,
          py: 3,
        }}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>
          Kaza Tem
        </Typography>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mb: 2 }} />
        <List disablePadding>
          {menuItems.map((item) => {
            const active = pathname?.startsWith(item.href);
            const badgeCount = item.badgeKey ? badgeMap[item.badgeKey] : 0;
            return (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                sx={{
                  color: '#fff',
                  mb: 0.5,
                  borderRadius: 1,
                  backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
              >
                <ListItemIcon sx={{ color: '#fff', minWidth: 'auto', mr: 1.5 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    badgeCount > 0 ? (
                      <Badge
                        badgeContent={badgeCount}
                        color={item.badgeKey === 'pendingRegistrations' ? 'error' : 'warning'}
                        sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 20, minWidth: 20 } }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.label}
                        </Typography>
                      </Badge>
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.label}
                      </Typography>
                    )
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="rgba(255,255,255,0.6)">
          Sessão admin · {user?.name ?? 'Usuário'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            px: { xs: 2, md: 4 },
            py: 2,
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Painel Administrativo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.name ? `Olá, ${user.name}` : 'Bem-vindo'}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, px: { xs: 2, md: 4 }, py: 4 }}>{children}</Box>
      </Box>
    </Box>
  );
}
