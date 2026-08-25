'use client';

import { useCheckoutContext } from '../contexts/CheckoutContext';

export function useCheckout() {
  return useCheckoutContext();
}
