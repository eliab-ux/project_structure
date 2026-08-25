'use client';

import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useCheckout } from '@/hooks/useCheckout';
import { CardForm, CardData } from './CardForm';

interface PaymentFormProps {
  onComplete?: () => void;
}

const INITIAL_CARD: CardData = {
  cardNumber: '',
  holder: '',
  expiration: '',
  securityCode: '',
  brand: '',
};

export function PaymentForm({ onComplete }: PaymentFormProps) {
  const { paymentMethod, setPaymentMethod } = useCheckout();
  const [card, setCard] = useState<CardData>(paymentMethod ?? INITIAL_CARD);
  const [installments, setInstallments] = useState(paymentMethod?.installments ?? 1);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPaymentMethod({ ...card, installments });
    onComplete?.();
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2, p: 3 }}
    >
      <Typography variant="h6" mb={2}>
        Dados do cartão
      </Typography>
      <Stack spacing={2}>
        <CardForm value={card} onChange={setCard} />
        <TextField
          label="Parcelas"
          type="number"
          value={installments}
          onChange={(event) => setInstallments(Number(event.target.value))}
          inputProps={{ min: 1 }}
        />
        <Button type="submit" variant="contained">
          Salvar pagamento
        </Button>
      </Stack>
    </Box>
  );
}
