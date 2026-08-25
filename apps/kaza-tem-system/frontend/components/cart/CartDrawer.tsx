'use client';

import { useRouter } from 'next/navigation';
import { Stack, Typography, Divider, Button, IconButton, Drawer, Box } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useCart } from '@/hooks/useCart';
import { ShippingCalculator } from '../shipping/ShippingCalculator';
import { useCheckout } from '@/hooks/useCheckout';
import { CartItems } from './CartItems';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const router = useRouter();
  const { subtotal, itemCount } = useCart();
  const { setShippingOption } = useCheckout();

  function handleCheckout() {
    onClose();
    router.push('/checkout/address');
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 420 } }}>
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">Carrinho ({itemCount})</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Stack>

        <Stack spacing={2} flex={1}>
          <CartItems />
          <ShippingCalculator onSelectOption={(option) => setShippingOption(option)} />
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={1} mt="auto">
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle2">Subtotal</Typography>
            <Typography variant="subtitle2">R$ {subtotal.toFixed(2)}</Typography>
          </Stack>
          <Button variant="contained" disabled={itemCount === 0} onClick={handleCheckout}>
            Finalizar compra
          </Button>
          <Typography variant="caption" color="text.secondary">
            O frete e pagamento são definidos nos próximos passos.
          </Typography>
        </Stack>
      </Box>
    </Drawer>
  );
}
