'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Título da página com a ação principal à direita.
 *
 * Existe para que as três telas de administração não repitam o mesmo `Stack` com os mesmos
 * espaçamentos — três cópias divergiriam no primeiro ajuste de layout, e a divergência entre telas
 * irmãs é o tipo de coisa que ninguém reporta como bug e todo mundo percebe.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      component="header"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 3 }}
    >
      <Box>
        <Typography variant="h1">{title}</Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {action}
    </Stack>
  );
}
