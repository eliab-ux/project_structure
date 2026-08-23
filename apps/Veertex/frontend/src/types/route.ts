/** Espelhos dos DTOs do ROT (04): rotas, viagens, acerto e fechamento. */

export interface Route {
  id: string;
  name: string;
  code: string | null;
  cycleDays: number;
  active: boolean;
  createdAt: string;
}

export interface CommercialRule {
  userId: string;
  allowedCompanyIds: string[];
  allowedPaymentConditionIds: string[];
  allowedPriceListIds: string[];
  allowedOperationNatures: string[];
}

export type TripStatus = 'planejada' | 'em_andamento' | 'em_fechamento' | 'fechada' | 'cancelada';

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  em_fechamento: 'Em fechamento',
  fechada: 'Fechada',
  cancelada: 'Cancelada',
};

export interface Trip {
  id: string;
  companyId: string;
  routeId: string;
  salesRepId: string;
  helperUserId: string | null;
  status: TripStatus;
  statusLabel: string;
  departureAt: string | null;
  returnAt: string | null;
  initialCash: number;
  returnCash: number | null;
  initialKm: number | null;
  finalKm: number | null;
  loadLocationId: string | null;
  createdAt: string;
}

export interface CargoLinePayload {
  productId: string;
  quantity: number;
}

export type FieldReceiptMethod = 'dinheiro' | 'pix' | 'cartao' | 'cheque' | 'deposito';

export const FIELD_RECEIPT_METHODS: FieldReceiptMethod[] = [
  'dinheiro',
  'pix',
  'cartao',
  'cheque',
  'deposito',
];

export const FIELD_RECEIPT_METHOD_LABEL: Record<FieldReceiptMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
  cheque: 'Cheque',
  deposito: 'Depósito',
};

export type TripExpenseCategory =
  'combustivel' | 'alimentacao' | 'hotel' | 'pedagio' | 'manutencao' | 'outros';

export const TRIP_EXPENSE_CATEGORIES: TripExpenseCategory[] = [
  'combustivel',
  'alimentacao',
  'hotel',
  'pedagio',
  'manutencao',
  'outros',
];

export const TRIP_EXPENSE_CATEGORY_LABEL: Record<TripExpenseCategory, string> = {
  combustivel: 'Combustível',
  alimentacao: 'Alimentação',
  hotel: 'Hotel',
  pedagio: 'Pedágio',
  manutencao: 'Manutenção',
  outros: 'Outros',
};

export interface BuildTripWalletResult {
  added: { titleId: string; kind: string; amount: number }[];
  writtenOffPending: string[];
  walletTotal: number;
}

export interface FieldReceiptResult {
  id: string;
  status: string;
  insideWallet: boolean;
}

export interface EffectuateFieldReceiptResult {
  receiptId: string;
  status: string;
  titleStatus: string | null;
}

export interface ReturnConsignedItemsResult {
  movements: { productId: string; quantity: number; usedFallback: boolean }[];
}

export interface ExchangeResult {
  inMovementId: string;
  outMovementId: string;
}

export interface TripExpenseResult {
  id: string;
  category: string;
  amount: number;
}

export interface TripClosureSummary {
  cobranca: { wallet: number; received: number; percent: number };
  recobranca: { wallet: number; received: number; percent: number };
  interestReceived: number;
  otherReceipts: number;
  expenses: { byCategory: Record<string, number>; total: number; percentOfReceived: number };
  cash: { expected: number; counted: number | null; difference: number | null };
  commission: {
    wallet: number;
    received: number;
    ratioPercent: number;
    appliedThresholdPercent: number | null;
    commissionPercent: number;
    repCommission: number;
    managerCommission: number;
    helperAmount: number;
    payableTitleIds: string[];
  };
  previousTrip: {
    tripId: string;
    departureAt: string | null;
    wallet: number;
    received: number;
    receivedPercent: number;
    expensesTotal: number;
    deltas: { received: number; receivedPercent: number; expensesTotal: number };
  } | null;
}

export type EvidenceType = 'gps' | 'foto_comprovante' | 'foto_promissoria';

export interface OrderEvidenceResult {
  id: string;
  type: string;
  objectKey: string | null;
}

export interface PromissoryNoteResult {
  id: string;
  amount: number;
  amountInWords: string;
  debtorName: string;
  debtorDocument: string | null;
  dueDate: string;
}

export interface TripDetails {
  trip: Trip;
  wallet: { titleId: string; kind: string; amountAtBuild: number }[];
  receipts: {
    id: string;
    titleId: string | null;
    method: string;
    amount: number;
    interest: number;
    insideWallet: boolean;
    status: string;
    createdAt: string;
  }[];
  expenses: {
    id: string;
    category: string;
    amount: number;
    note: string | null;
    spentAt: string;
  }[];
}
