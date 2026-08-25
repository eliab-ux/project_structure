'use client';

import { Stack, Typography } from '@mui/material';

type PriceDisplayProps = {
  price: number;
  compareAt?: number;
};

export function PriceDisplay({ price, compareAt }: PriceDisplayProps) {
  const formattedPrice = price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const savings = compareAt && compareAt > price ? compareAt - price : 0;
  const formattedSavings = savings
    ? savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null;

  const installment = (price / 6).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <Stack spacing={1}>
      <Typography variant="h4" color="primary">
        {formattedPrice}
      </Typography>
      {compareAt && compareAt > price ? (
        <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
          {compareAt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </Typography>
      ) : null}
      {formattedSavings ? (
        <Typography variant="body2" color="success.main">
          Você economiza {formattedSavings}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        Em até 6x de {installment} sem juros
      </Typography>
    </Stack>
  );
}
