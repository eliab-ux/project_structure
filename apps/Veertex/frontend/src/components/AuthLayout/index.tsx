'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * A moldura de login, esqueci-a-senha e redefinir-senha. HTML semântico conforme o CLAUDE.md §3.
 *
 * Revestida com os tokens do tema (§5.3): o mesmo `vx.panel` e a mesma borda `vx.accent` da Mesa e
 * dos painéis de administração. A tela de entrada é a primeira coisa que o operador vê do sistema, e
 * um login com acabamento de outro produto faz o resto parecer emendado.
 *
 * **O que NÃO mudou, e não pode mudar:** as mensagens genéricas. O login não diz "e-mail não
 * cadastrado" e a recuperação responde igual para e-mail que existe e para e-mail que não existe —
 * a diferença entregaria quais contas existem. O atraso progressivo por credencial também não é
 * anunciado: dizer "aguarde 4s" ensina o atacante a medir o próprio progresso.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        component="section"
        aria-label={title}
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          border: 1,
          bgcolor: 'vx.panel',
          borderColor: 'vx.accent.300',
        }}
      >
        <Box component="header" sx={{ mb: 3 }}>
          <Typography variant="h1" color="primary.main" sx={{ mb: 0.5 }}>
            Veertex
          </Typography>
          <Typography variant="h2" component="h2" sx={{ mb: subtitle ? 0.5 : 0 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        {children}

        {footer ? <Box sx={{ mt: 3 }}>{footer}</Box> : null}
      </Paper>
    </Box>
  );
}
