import api from './api';

interface PaymentRequest {
  card: {
    number: string;
    holder: string;
    expirationDate: string;
    securityCode: string;
    brand: string;
  };
  installments: number;
  amount?: number;
}

async function processPayment(orderId: string, data: PaymentRequest) {
  const response = await api.post(`/orders/${orderId}/pay`, data);
  return response.data;
}

export const paymentService = { processPayment };
