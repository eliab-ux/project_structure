'use client';

import { Drawer, Stack, Typography, Button } from '@mui/material';
import { FilterSidebar } from './FilterSidebar';

type FilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  categories: string[];
  selectedCategory?: string;
  priceRange: [number, number];
  onCategoryChange: (category?: string) => void;
  onPriceRangeChange: (value: number[]) => void;
  onReset?: () => void;
};

export function FilterDrawer({ open, onClose, ...sidebarProps }: FilterDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Stack sx={{ width: 320, p: 3 }} spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Filtros</Typography>
          <Button size="small" onClick={onClose}>
            Fechar
          </Button>
        </Stack>
        <FilterSidebar
          {...sidebarProps}
          onReset={() => {
            sidebarProps.onReset?.();
            onClose();
          }}
        />
      </Stack>
    </Drawer>
  );
}
