'use client';

import { useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { QuantitySelector } from './QuantitySelector';
import { useCart } from '@/hooks/useCart';
import { Product } from '@/services/productService';

type ProductPurchasePanelProps = {
  product: Pick<Product, 'id' | 'sku' | 'name' | 'price'>;
  stock: number;
};

export function ProductPurchasePanel({ product, stock }: ProductPurchasePanelProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const handleAddToCart = () => {
    if (quantity > stock) {
      setMessage('Quantidade indisponível em estoque.');
      return;
    }
    addItem(
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
      },
      quantity,
    );
    setMessage(`Adicionado ${quantity} item(ns) ao carrinho.`);
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1">Quantidade</Typography>
        <QuantitySelector value={quantity} onChange={setQuantity} />
      </Stack>
      <Button variant="contained" size="large" onClick={handleAddToCart} disabled={stock === 0}>
        {stock === 0 ? 'Esgotado' : 'Adicionar ao carrinho'}
      </Button>
      {message ? <Alert severity="success">{message}</Alert> : null}
    </Stack>
  );
}
