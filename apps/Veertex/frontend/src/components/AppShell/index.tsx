'use client';

import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from 'src/contexts/AuthContext';

/**
 * The authenticated frame: header, account identification and the sign-out menu.
 *
 * The navigation menu itself is intentionally absent in F1. The Visão Geral (§2.1) defines it as
 * `plano ∩ conta ∩ papel`, and two of those three — the module catalogue and per-account
 * activation — arrive in F2. Building a menu now would mean hardcoding a module list that the next
 * slice replaces.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, account, role, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

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
