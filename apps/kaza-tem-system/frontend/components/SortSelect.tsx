'use client';

import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from '@mui/material';

export type SortOption = {
  value: string;
  label: string;
};

type SortSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
};

export function SortSelect({ value, onChange, options }: SortSelectProps) {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <InputLabel id="sort-select-label">Ordenar por</InputLabel>
      <Select
        labelId="sort-select-label"
        id="sort-select"
        value={value}
        label="Ordenar por"
        onChange={handleChange}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
