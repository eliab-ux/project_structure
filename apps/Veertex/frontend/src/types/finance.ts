/** Espelhos dos DTOs do FIN (05): contas, categorias, títulos e baixas. */

export type FinancialAccountType = 'cash' | 'bank' | 'payment_integration';

export const FINANCIAL_ACCOUNT_TYPES: FinancialAccountType[] = [
  'cash',
  'bank',
  'payment_integration',
];

export const FINANCIAL_ACCOUNT_TYPE_LABEL: Record<FinancialAccountType, string> = {
  cash: 'Caixa',
  bank: 'Conta bancária',
  payment_integration: 'Integração de pagamento',
};

export interface FinancialAccount {
  id: string;
  name: string;
  type: FinancialAccountType;
  typeLabel: string;
  institution: string | null;
  initialBalance: number;
  automatic: boolean;
  active: boolean;
}

export type CategoryKind = 'revenue' | 'expense' | 'neutral';

export const CATEGORY_KINDS: CategoryKind[] = ['revenue', 'expense', 'neutral'];

export const CATEGORY_KIND_LABEL: Record<CategoryKind, string> = {
  revenue: 'Receita',
  expense: 'Despesa',
  neutral: 'Neutra',
};

export interface FinancialCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  dreLine: string | null;
  defaultOperation: string | null;
  active: boolean;
}

export type TitleDirection = 'receivable' | 'payable';

export type TitleStatus =
  'open' | 'partial' | 'settled' | 'renegotiated' | 'written_off_pending' | 'written_off';

export const TITLE_STATUS_LABEL: Record<TitleStatus, string> = {
  open: 'Em aberto',
  partial: 'Parcial',
  settled: 'Baixado',
  renegotiated: 'Renegociado',
  written_off_pending: 'Perdida (pendente)',
  written_off: 'Perdida',
};

export type SettlementMethod =
  'dinheiro' | 'pix' | 'cartao' | 'boleto' | 'cheque' | 'transferencia' | 'outro';

export const SETTLEMENT_METHODS: SettlementMethod[] = [
  'dinheiro',
  'pix',
  'cartao',
  'boleto',
  'cheque',
  'transferencia',
  'outro',
];

export const SETTLEMENT_METHOD_LABEL: Record<SettlementMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
  boleto: 'Boleto',
  cheque: 'Cheque',
  transferencia: 'Transferência',
  outro: 'Outro',
};

export interface TitleSettlement {
  id: string;
  financialAccountId: string;
  method: SettlementMethod;
  principal: number;
  interest: number;
  fine: number;
  discount: number;
  cashAmount: number;
  settledAt: string;
}

export interface FinancialTitle {
  id: string;
  companyId: string;
  direction: TitleDirection;
  contactId: string | null;
  categoryId: string | null;
  description: string;
  amount: number;
  openAmount: number;
  settledPrincipal: number;
  status: TitleStatus;
  origin: string;
  issueDate: string;
  dueDate: string;
  settlements: TitleSettlement[];
  createdAt: string;
}

export interface CreateTitlePayload {
  companyId: string;
  contactId?: string | null;
  categoryId?: string | null;
  description: string;
  amount: number;
  issueDate?: string;
  dueDate: string;
}

export interface SettleTitlePayload {
  financialAccountId: string;
  method: SettlementMethod;
  principal: number;
  settledAt?: string;
  interest?: number;
  fine?: number;
  discount?: number;
}
