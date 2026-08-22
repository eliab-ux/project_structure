import api from 'src/services/api';

export interface StockBalance {
  companyId: string;
  productId: string;
  productName: string;
  quantity: number;
  averageCost: number;
  available: number;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  belowMinimum: boolean;
  aboveMaximum: boolean;
}

async function balance(companyId: string, productId: string): Promise<StockBalance> {
  const response = await api.get<StockBalance>('/stock/balance', {
    params: { companyId, productId },
  });
  return response.data;
}

const stockService = { balance };

export default stockService;
