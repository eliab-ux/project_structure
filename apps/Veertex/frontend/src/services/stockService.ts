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

export type StockLocationKind = 'warehouse' | 'rep_load' | 'pdv';

export const STOCK_LOCATION_KIND_LABEL: Record<StockLocationKind, string> = {
  warehouse: 'Depósito',
  rep_load: 'Carga de representante',
  pdv: 'PDV',
};

export interface StockLocation {
  id: string;
  companyId: string;
  kind: StockLocationKind;
  name: string;
  active: boolean;
}

export type StockMovementType =
  | 'purchase_in'
  | 'sale_out'
  | 'inventory_adjust'
  | 'customer_return'
  | 'supplier_return'
  | 'loss'
  | 'transfer_out'
  | 'transfer_in'
  | 'trip_load'
  | 'trip_return'
  | 'exchange_in'
  | 'exchange_out';

/** Os tipos que o registro MANUAL aceita (transferência tem endpoint próprio; os da rota são do ROT). */
export const REGISTERABLE_MOVEMENT_TYPES: StockMovementType[] = [
  'purchase_in',
  'sale_out',
  'inventory_adjust',
  'customer_return',
  'supplier_return',
  'loss',
];

export const STOCK_MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  purchase_in: 'Entrada por compra',
  sale_out: 'Saída por venda',
  inventory_adjust: 'Ajuste de inventário',
  customer_return: 'Devolução de cliente',
  supplier_return: 'Devolução a fornecedor',
  loss: 'Perda',
  transfer_out: 'Transferência (saída)',
  transfer_in: 'Transferência (entrada)',
  trip_load: 'Carga de viagem',
  trip_return: 'Retorno de viagem',
  exchange_in: 'Troca (entrada)',
  exchange_out: 'Troca (saída)',
};

export interface StockMovement {
  id: string;
  companyId: string;
  productId: string;
  locationId: string;
  type: StockMovementType;
  typeLabel: string;
  signedQuantity: number;
  unitCost: number | null;
  usedFallback: boolean;
  relatedMovementId: string | null;
  note: string | null;
  occurredAt: string;
}

async function balance(
  companyId: string,
  productId: string,
  locationId?: string,
): Promise<StockBalance> {
  const response = await api.get<StockBalance>('/stock/balance', {
    params: { companyId, productId, ...(locationId ? { locationId } : {}) },
  });
  return response.data;
}

async function listLocations(companyId: string): Promise<StockLocation[]> {
  const response = await api.get<StockLocation[]>('/stock/locations', { params: { companyId } });
  return response.data;
}

async function createLocation(payload: {
  companyId: string;
  kind: StockLocationKind;
  name: string;
}): Promise<StockLocation> {
  const response = await api.post<StockLocation>('/stock/locations', payload);
  return response.data;
}

async function listMovements(
  params: { companyId?: string; productId?: string; type?: string } = {},
): Promise<StockMovement[]> {
  const response = await api.get<StockMovement[]>('/stock/movements', { params });
  return response.data;
}

async function registerMovement(payload: {
  companyId: string;
  productId: string;
  locationId: string;
  type: StockMovementType;
  quantity: number;
  unitCost?: number | null;
  note?: string | null;
  occurredAt?: string;
}): Promise<StockMovement> {
  const response = await api.post<StockMovement>('/stock/movements', payload);
  return response.data;
}

async function transfer(payload: {
  companyId: string;
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  note?: string | null;
}): Promise<{ out: StockMovement; in: StockMovement }> {
  const response = await api.post<{ out: StockMovement; in: StockMovement }>(
    '/stock/transfers',
    payload,
  );
  return response.data;
}

const stockService = {
  balance,
  listLocations,
  createLocation,
  listMovements,
  registerMovement,
  transfer,
};

export default stockService;
