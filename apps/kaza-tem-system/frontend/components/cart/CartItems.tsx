'use client';

import { Box, IconButton, Stack, Typography } from '@mui/material';
import { Add, Remove, Delete } from '@mui/icons-material';
import { useCart } from '@/hooks/useCart';

export function CartItems() {
  const { items, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return <Typography color="text.secondary">Seu carrinho ainda está vazio.</Typography>;
  }

  return (
    <Stack spacing={2}>
      {items.map((item) => (
        <Stack
          key={item.productId}
          direction="row"
          spacing={2}
          alignItems="center"
          sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)', pb: 2 }}
        >
          <Box
            component="img"
            src={item.image ?? '/placeholder.png'}
            alt={item.name}
            sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1 }}
          />
          <Stack flex={1} spacing={0.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              {item.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              SKU {item.sku}
            </Typography>
            <Typography variant="body2">
              R$ {item.price.toFixed(2)} x {item.quantity}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton
              size="small"
              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
            >
              <Remove fontSize="small" />
            </IconButton>
            <Typography>{item.quantity}</Typography>
            <IconButton
              size="small"
              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
            >
              <Add fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => removeItem(item.productId)}>
              <Delete fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
