'use client';

import { useCartContext } from '../contexts/CartContext';

export function useCart() {
  return useCartContext();
}
