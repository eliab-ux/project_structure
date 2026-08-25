# Módulo 04: FRONTEND CARRINHO E CHECKOUT

**Prioridade:** CRÍTICA
**Dependências:** Order Context (backend), Cielo, Melhor Envio
**Estimativa:** Frontend completo

---

## Objetivo

Implementar o fluxo completo de compra: carrinho, cálculo de frete, checkout e confirmação.

---

## 1. Páginas a Criar

| Página | Rota | Descrição |
|--------|------|-----------|
| Carrinho | `/cart` | Lista de itens, cupom, resumo |
| Endereço | `/checkout/address` | Formulário/seleção de endereço |
| Pagamento | `/checkout/payment` | Formulário de cartão |
| Revisão | `/checkout/review` | Confirmação final |
| Sucesso | `/checkout/success` | Pedido confirmado |

---

## 2. Estrutura de Pastas

```
frontend/
├── app/
│   ├── cart/
│   │   └── page.tsx
│   └── checkout/
│       ├── address/
│       │   └── page.tsx
│       ├── payment/
│       │   └── page.tsx
│       ├── review/
│       │   └── page.tsx
│       └── success/
│           └── page.tsx
├── components/
│   ├── cart/
│   │   ├── CartDrawer.tsx
│   │   ├── CartItems.tsx
│   │   ├── CartSummary.tsx
│   │   ├── CartIcon.tsx
│   │   └── CouponInput.tsx
│   ├── checkout/
│   │   ├── CheckoutStepper.tsx
│   │   ├── AddressForm.tsx
│   │   ├── AddressList.tsx
│   │   ├── ShippingOptions.tsx
│   │   ├── PaymentForm.tsx
│   │   ├── CardForm.tsx
│   │   └── OrderSummary.tsx
│   └── shipping/
│       └── ShippingCalculator.tsx
├── contexts/
│   ├── CartContext.tsx
│   └── CheckoutContext.tsx
├── hooks/
│   ├── useCart.ts
│   └── useCheckout.ts
└── services/
    ├── cartService.ts
    ├── shippingService.ts
    └── paymentService.ts
```

---

## 3. Cart Context

```typescript
// contexts/CartContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Carregar do localStorage
  useEffect(() => {
    const stored = localStorage.getItem('kazaTemCart');
    if (stored) {
      setItems(JSON.parse(stored));
    }
  }, []);

  // Salvar no localStorage
  useEffect(() => {
    localStorage.setItem('kazaTemCart', JSON.stringify(items));
  }, [items]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function addItem(item: Omit<CartItem, 'quantity'>, quantity = 1) {
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId);
      if (existing) {
        return prev.map(i =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
  }

  function removeItem(productId: string) {
    setItems(prev => prev.filter(i => i.productId !== productId));
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems(prev =>
      prev.map(i => (i.productId === productId ? { ...i, quantity } : i))
    );
  }

  function clearCart() {
    setItems([]);
  }

  return (
    <CartContext.Provider
      value={{ items, itemCount, subtotal, addItem, removeItem, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
```

---

## 4. Componentes Principais

### 4.1 CartDrawer

```typescript
// components/cart/CartDrawer.tsx
'use client';

import { Drawer, Box, Typography, IconButton, Button, Stack, Divider } from '@mui/material';
import { Close, Add, Remove, Delete } from '@mui/icons-material';
import { useCart } from '@/contexts/CartContext';
import { useRouter } from 'next/navigation';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, itemCount, subtotal, updateQuantity, removeItem } = useCart();
  const router = useRouter();

  function handleCheckout() {
    onClose();
    router.push('/checkout/address');
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 400, p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Carrinho ({itemCount})</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Stack>

        {items.length === 0 ? (
          <Typography color="text.secondary">Seu carrinho está vazio</Typography>
        ) : (
          <>
            <Stack spacing={2} divider={<Divider />}>
              {items.map(item => (
                <Stack key={item.productId} direction="row" spacing={2}>
                  <Box
                    component="img"
                    src={item.image}
                    sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1 }}
                  />
                  <Stack flex={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      R$ {item.price.toFixed(2)}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1} mt={1}>
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
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Subtotal</Typography>
              <Typography variant="h6">R$ {subtotal.toFixed(2)}</Typography>
            </Stack>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleCheckout}
            >
              Finalizar compra
            </Button>
          </>
        )}
      </Box>
    </Drawer>
  );
}
```

### 4.2 ShippingCalculator

```typescript
// components/shipping/ShippingCalculator.tsx
'use client';

import { useState } from 'react';
import { TextField, Button, Stack, Typography, Radio, RadioGroup, FormControlLabel } from '@mui/material';
import { shippingService, ShippingOption } from '@/services/shippingService';

interface ShippingCalculatorProps {
  onSelectOption: (option: ShippingOption) => void;
}

export function ShippingCalculator({ onSelectOption }: ShippingCalculatorProps) {
  const [cep, setCep] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selected, setSelected] = useState<string>();

  async function handleCalculate() {
    setLoading(true);
    try {
      const result = await shippingService.calculate(cep);
      setOptions(result);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(optionId: string) {
    setSelected(optionId);
    const option = options.find(o => o.id === optionId);
    if (option) onSelectOption(option);
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <TextField
          label="CEP"
          value={cep}
          onChange={e => setCep(e.target.value)}
          size="small"
          placeholder="00000-000"
        />
        <Button variant="outlined" onClick={handleCalculate} disabled={loading}>
          {loading ? 'Calculando...' : 'Calcular'}
        </Button>
      </Stack>

      {options.length > 0 && (
        <RadioGroup value={selected} onChange={e => handleSelect(e.target.value)}>
          {options.map(option => (
            <FormControlLabel
              key={option.id}
              value={option.id}
              control={<Radio />}
              label={
                <Stack direction="row" spacing={2}>
                  <Typography>{option.name}</Typography>
                  <Typography color="primary">R$ {option.price.toFixed(2)}</Typography>
                  <Typography color="text.secondary">
                    {option.deliveryDays} dias úteis
                  </Typography>
                </Stack>
              }
            />
          ))}
        </RadioGroup>
      )}
    </Stack>
  );
}
```

---

## 5. Services

### 5.1 Shipping Service

```typescript
// services/shippingService.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export interface ShippingOption {
  id: string;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
}

async function calculate(cep: string): Promise<ShippingOption[]> {
  const response = await fetch(`${API_BASE}/shipping/calculate?cep=${cep}`);
  if (!response.ok) throw new Error('Erro ao calcular frete');
  return response.json();
}

export const shippingService = { calculate };
```

### 5.2 Payment Service

```typescript
// services/paymentService.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

interface PaymentRequest {
  orderId: string;
  card: {
    number: string;
    holder: string;
    expirationDate: string;
    securityCode: string;
    brand: string;
  };
  installments: number;
}

async function processPayment(data: PaymentRequest, token: string) {
  const response = await fetch(`${API_BASE}/orders/${data.orderId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao processar pagamento');
  }

  return response.json();
}

export const paymentService = { processPayment };
```

---

## 6. Checkout Flow

```
1. /cart
   - Lista de itens
   - Cupom de desconto
   - Cálculo de frete
   - Botão "Finalizar compra"

2. /checkout/address
   - Formulário de endereço (ou selecionar salvo)
   - Opções de frete
   - Botão "Continuar"

3. /checkout/payment
   - Formulário de cartão
   - Parcelas
   - Botão "Continuar"

4. /checkout/review
   - Resumo completo
   - Itens + endereço + pagamento
   - Botão "Confirmar pedido"

5. /checkout/success
   - Número do pedido
   - Status
   - Próximos passos
```

---

## 7. Checklist de Implementação

### Contexts & Hooks
- [ ] Criar `CartContext.tsx`
- [ ] Criar `CheckoutContext.tsx`
- [ ] Criar `useCart.ts`
- [ ] Criar `useCheckout.ts`

### Services
- [ ] Criar `cartService.ts`
- [ ] Criar `shippingService.ts`
- [ ] Criar `paymentService.ts`

### Cart Components
- [ ] Criar `CartDrawer.tsx`
- [ ] Criar `CartItems.tsx`
- [ ] Criar `CartSummary.tsx`
- [ ] Criar `CartIcon.tsx`
- [ ] Criar `CouponInput.tsx`

### Checkout Components
- [ ] Criar `CheckoutStepper.tsx`
- [ ] Criar `AddressForm.tsx`
- [ ] Criar `AddressList.tsx`
- [ ] Criar `ShippingOptions.tsx`
- [ ] Criar `ShippingCalculator.tsx`
- [ ] Criar `PaymentForm.tsx`
- [ ] Criar `CardForm.tsx`
- [ ] Criar `OrderSummary.tsx`

### Pages
- [ ] Criar `/cart/page.tsx`
- [ ] Criar `/checkout/address/page.tsx`
- [ ] Criar `/checkout/payment/page.tsx`
- [ ] Criar `/checkout/review/page.tsx`
- [ ] Criar `/checkout/success/page.tsx`

### Layout
- [ ] Adicionar `CartProvider` no layout raiz
- [ ] Adicionar `CartIcon` no header
- [ ] Criar layout específico para checkout

### Testes
- [ ] Testar fluxo completo de compra
- [ ] Testar cálculo de frete
- [ ] Testar pagamento (sandbox Cielo)
- [ ] Testar responsividade mobile

---

**Próximo módulo:** [05-ANALYTICS-CONTEXT.md](./05-ANALYTICS-CONTEXT.md)
