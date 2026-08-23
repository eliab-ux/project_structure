/** Espelhos dos DTOs de configuração comercial do VND (02A): preço, condição, comissão A. */

export interface PriceListItem {
  id: string;
  productId: string;
  price: number;
  minQuantity: number;
}

export interface PriceList {
  id: string;
  name: string;
  active: boolean;
  contactId: string | null;
  salesRepId: string | null;
  items: PriceListItem[];
  createdAt: string;
}

export type PriceSource =
  'item_negotiated' | 'contact_list' | 'sales_rep_list' | 'channel_list' | 'pdv_list' | 'base';

export const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  item_negotiated: 'Negociado no item',
  contact_list: 'Tabela do cliente',
  sales_rep_list: 'Tabela do vendedor',
  channel_list: 'Tabela do canal',
  pdv_list: 'Tabela do PDV',
  base: 'Preço base do produto',
};

export interface ResolvedPrice {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  source: PriceSource;
  priceListId: string | null;
}

export interface PriceListItemPayload {
  productId: string;
  price: number;
  minQuantity?: number;
}

export interface CreatePriceListPayload {
  name: string;
  contactId?: string | null;
  salesRepId?: string | null;
  items: PriceListItemPayload[];
}

export type UpdatePriceListPayload = Partial<CreatePriceListPayload> & { active?: boolean };

export type PaymentConditionKind =
  'promissoria' | 'a_vista' | 'cartao' | 'cheque_pre' | 'pix' | 'boleto';

export const PAYMENT_CONDITION_KINDS: PaymentConditionKind[] = [
  'a_vista',
  'pix',
  'cartao',
  'boleto',
  'cheque_pre',
  'promissoria',
];

export const PAYMENT_CONDITION_KIND_LABEL: Record<PaymentConditionKind, string> = {
  promissoria: 'Promissória',
  a_vista: 'À vista',
  cartao: 'Cartão',
  cheque_pre: 'Cheque pré-datado',
  pix: 'Pix',
  boleto: 'Boleto',
};

export interface PaymentCondition {
  id: string;
  name: string;
  kind: PaymentConditionKind;
  kindLabel: string;
  active: boolean;
  createdAt: string;
}

export interface CommissionTier {
  thresholdPercent: number;
  commissionPercent: number;
}

export interface SalesTarget {
  id: string;
  userId: string;
  period: string;
  targetValue: number;
}

export interface CommissionModelAResult {
  salesRepId: string;
  period: string;
  meta: number;
  vendido: number;
  ratioPercent: number;
  appliedThresholdPercent: number | null;
  commissionPercent: number;
  commissionValue: number;
  payableTitleId: string | null;
}
