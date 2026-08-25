'use client';

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ShippingOption } from '../services/shippingService';

interface CheckoutState {
  shippingAddress: {
    street: string;
    number: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    complement?: string;
  } | null;
  shippingOption: ShippingOption | null;
  paymentMethod: {
    cardNumber: string;
    holder: string;
    expiration: string;
    securityCode: string;
    brand: string;
    installments: number;
  } | null;
  orderId: string | null;
}

interface CheckoutContextValue extends CheckoutState {
  setShippingAddress: (address: CheckoutState['shippingAddress']) => void;
  setShippingOption: (option: ShippingOption | null) => void;
  setPaymentMethod: (payment: CheckoutState['paymentMethod']) => void;
  setOrderId: (id: string | null) => void;
  resellerId: string | null;
  visitorId: string | null;
  setResellerId: (id: string | null) => void;
  setVisitorId: (id: string | null) => void;
}

const CheckoutContext = createContext<CheckoutContextValue | undefined>(undefined);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [shippingAddress, setShippingAddress] = useState<CheckoutState['shippingAddress']>(null);
  const [shippingOption, setShippingOption] = useState<ShippingOption | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutState['paymentMethod']>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);

  useEffect(() => {
    setResellerId(getCookie('kazaTemResellerId'));
    setVisitorId(getCookie('kazaTemVisitorId'));
  }, []);

  const value = useMemo(
    () => ({
      shippingAddress,
      shippingOption,
      paymentMethod,
      orderId,
      resellerId,
      visitorId,
      setShippingAddress,
      setShippingOption,
      setPaymentMethod,
      setOrderId,
      setResellerId,
      setVisitorId,
    }),
    [shippingAddress, shippingOption, paymentMethod, orderId, resellerId, visitorId],
  );

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function useCheckoutContext() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckoutContext must be used within CheckoutProvider');
  }
  return context;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie
    .split(';')
    .map((cookie) => cookie.trim().split('='))
    .find(([key]) => key === name);
  return match ? decodeURIComponent(match[1] ?? '') : null;
}
