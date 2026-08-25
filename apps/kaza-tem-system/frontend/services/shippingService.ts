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
  if (!response.ok) {
    throw new Error('Erro ao calcular frete');
  }
  return response.json();
}

export const shippingService = { calculate };
