'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 2.5,
        mb: 2.5,
        flexWrap: 'wrap',
      }}
    >
      <Box>
        <Typography variant="h2" component="h1">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: '80ch' }}>
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}
