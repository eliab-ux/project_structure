'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCheckout } from '@/hooks/useCheckout';
import { createSubscription } from '@/services/subscriptionService';

const CARD_BRANDS = ['Visa', 'Master', 'Elo', 'Amex', 'Hipercard'];

export default function ResellerSubscriptionCreatePage() {
  const { resellerId } = useCheckout();
  const [cardNumber, setCardNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [expiration, setExpiration] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [brand, setBrand] = useState(CARD_BRANDS[0]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | undefined>();

  async function handleSubmit() {
    if (!resellerId) {
      setStatus('error');
      setMessage('Cadastre um revendedor aprovado antes de criar a assinatura.');
      return;
    }

    if (!cardNumber || !holder || !expiration || !securityCode || !email || !name || !document) {
      setStatus('error');
      setMessage('Preencha todos os campos obrigatórios.');
      return;
    }

    setStatus('processing');
    setMessage('Criando assinatura...');

    try {
      await createSubscription({
        resellerId,
        card: {
          number: cardNumber,
          holder,
          expirationDate: expiration,
          securityCode,
          brand,
        },
        customer: {
          name,
          email,
          document,
        },
      });
      setStatus('success');
      setMessage('Assinatura criada! Em breve você receberá confirmações por e-mail.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro inesperado ao criar assinatura.');
    }
  }

  const isProcessing = status === 'processing';

  return (
    <Box sx={{ p: { xs: 3, md: 6 } }}>
      <Typography variant="h4" gutterBottom>
        Criar assinatura
      </Typography>
      <Typography sx={{ mb: 3 }}>
        Assinatura mensal R$ 9,90. Insira os dados do cartão para ativar a recorrência.
      </Typography>
      {message && (
        <Alert severity={status === 'error' ? 'error' : 'success'} sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}
      <Stack spacing={2} sx={{ maxWidth: 520 }}>
        <TextField
          label="Nome completo"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <TextField
          label="E-mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <TextField
          label="CPF ou CNPJ"
          value={document}
          onChange={(event) => setDocument(event.target.value)}
          required
        />
        <TextField
          label="Número do cartão"
          value={cardNumber}
          onChange={(event) => setCardNumber(event.target.value)}
          required
        />
        <TextField
          label="Titular do cartão"
          value={holder}
          onChange={(event) => setHolder(event.target.value)}
          required
        />
        <TextField
          label="Validade (MM/YY)"
          value={expiration}
          onChange={(event) => setExpiration(event.target.value)}
          required
        />
        <TextField
          label="Código de segurança"
          value={securityCode}
          onChange={(event) => setSecurityCode(event.target.value)}
          required
        />
        <TextField
          select
          label="Bandeira"
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
        >
          {CARD_BRANDS.map((item) => (
            <MenuItem key={item} value={item}>
              {item}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" size="large" onClick={handleSubmit} disabled={isProcessing}>
          {isProcessing ? <CircularProgress size={24} color="inherit" /> : 'Criar assinatura'}
        </Button>
      </Stack>
    </Box>
  );
}
