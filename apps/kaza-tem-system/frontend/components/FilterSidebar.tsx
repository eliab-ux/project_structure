'use client';

import { Box, Button, Divider, Slider, Stack, Typography } from '@mui/material';

type FilterSidebarProps = {
  categories: string[];
  selectedCategory?: string;
  priceRange: [number, number];
  onCategoryChange: (category?: string) => void;
  onPriceRangeChange: (value: number[]) => void;
  onReset?: () => void;
};

const MAX_PRICE = 2000;

export function FilterSidebar({
  categories,
  selectedCategory,
  priceRange,
  onCategoryChange,
  onPriceRangeChange,
  onReset,
}: FilterSidebarProps) {
  return (
    <Box
      component="section"
      sx={{
        width: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        p: 3,
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={3}>
        <Typography variant="h6">Filtros</Typography>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Categorias
          </Typography>
          <Stack spacing={1}>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'contained' : 'outlined'}
                size="small"
                onClick={() => onCategoryChange(category)}
                sx={{ justifyContent: 'flex-start' }}
              >
                {category}
              </Button>
            ))}

            <Button
              variant="text"
              size="small"
              onClick={() => onCategoryChange(undefined)}
              sx={{ justifyContent: 'flex-start' }}
            >
              Limpar categoria
            </Button>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Faixa de preço
          </Typography>
          <Slider
            value={priceRange}
            min={0}
            max={MAX_PRICE}
            onChange={(_, value) => onPriceRangeChange(value as number[])}
            valueLabelDisplay="auto"
          />
          <Typography variant="body2">
            {`De R$ ${priceRange[0]} até R$ ${priceRange[1]}`}
          </Typography>
        </Box>

        {onReset ? (
          <Button variant="outlined" onClick={onReset}>
            Limpar filtros
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
