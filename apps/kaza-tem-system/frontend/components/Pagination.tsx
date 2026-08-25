'use client';

import { Button, Stack, Typography } from '@mui/material';

type PaginationProps = {
  page: number;
  onPageChange: (page: number) => void;
  hasNext: boolean;
};

export function Pagination({ page, onPageChange, hasNext }: PaginationProps) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
      <Button variant="outlined" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Anterior
      </Button>
      <Typography>Page {page}</Typography>
      <Button variant="outlined" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
        Próxima
      </Button>
    </Stack>
  );
}
