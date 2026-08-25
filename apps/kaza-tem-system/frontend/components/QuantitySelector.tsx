'use client';

import { Stack, IconButton, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useMemo } from 'react';

type QuantitySelectorProps = {
  value: number;
  onChange: (value: number) => void;
};

export function QuantitySelector({ value, onChange }: QuantitySelectorProps) {
  const formattedValue = useMemo(() => value.toString(), [value]);

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <IconButton size="small" onClick={() => onChange(Math.max(1, value - 1))}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <TextField
        value={formattedValue}
        onChange={(event) => {
          const numeric = Number(event.target.value);
          if (!Number.isNaN(numeric) && numeric >= 1) {
            onChange(numeric);
          }
        }}
        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', style: { textAlign: 'center' } }}
        size="small"
        sx={{ width: 80 }}
      />
      <IconButton size="small" onClick={() => onChange(value + 1)}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
