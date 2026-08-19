'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { CuttingTable } from 'src/components/CuttingTable';
import { FONT_MONO } from 'src/theme/theme';

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Aviso destacado abaixo do formulário — o bloco com a barra azul à esquerda. */
  help?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Moldura das telas de acesso: a mesa de corte à esquerda, o formulário à direita.
 *
 * As três telas (entrar, recuperar senha, trocar senha) usam a mesma moldura de propósito. Quem
 * pede o código de recuperação está na mesma sessão de quem tentou entrar trinta segundos antes;
 * trocar a tela inteira no meio do caminho faria parecer outro sistema, justamente no momento em
 * que a pessoa já está insegura sobre a própria senha.
 *
 * Abaixo de 940px a mesa vira uma faixa no topo e o formulário ocupa o resto — no celular a
 * coluna dupla espremeria os campos, e é do campo que a pessoa precisa.
 */
export function AuthLayout({ title, description, children, help, footer }: AuthLayoutProps) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.25fr 1fr' },
        gridTemplateRows: { xs: 'auto 1fr', md: '1fr' },
      }}
    >
      <CuttingTable />

      <Box
        component="main"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          bgcolor: 'background.default',
          px: { xs: 3, sm: 5, md: 8 },
          py: { xs: 4.25, md: 5.5 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 376, mx: 'auto' }}>
          <Typography variant="h2" component="h1" sx={{ fontSize: 27 }}>
            {title}
          </Typography>

          {description && (
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontSize: 14.5, lineHeight: 1.5, mt: 1, mb: 3.75 }}
            >
              {description}
            </Typography>
          )}

          {children}

          {help && (
            <Box
              sx={{
                display: 'flex',
                gap: 1.125,
                alignItems: 'flex-start',
                mt: 2.5,
                px: 1.625,
                py: 1.5,
                borderLeft: '3px solid',
                borderColor: 'info.main',
                bgcolor: 'info.light',
                borderRadius: '0 9px 9px 0',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'primary.light',
              }}
            >
              {help}
            </Box>
          )}

          {footer && (
            <Box
              sx={{
                mt: 4.75,
                pt: 2.25,
                borderTop: '1px solid',
                borderColor: 'divider',
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                letterSpacing: '.04em',
                color: 'text.secondary',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              {footer}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
