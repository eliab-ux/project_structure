/**
 * Tipo da conta financeira (§2.3 do 05). `cash` (caixa), `bank` (conta bancária) e
 * `payment_integration` (conta alimentada por integração — preparação para COB/Open Finance).
 */
export const FINANCIAL_ACCOUNT_TYPES = ['cash', 'bank', 'payment_integration'] as const;

export type FinancialAccountType = (typeof FINANCIAL_ACCOUNT_TYPES)[number];

export const FINANCIAL_ACCOUNT_TYPE_LABEL: Record<FinancialAccountType, string> = {
  cash: 'Caixa',
  bank: 'Banco',
  payment_integration: 'Integração de pagamento',
};
