export const FINANCE_DASHBOARD = Symbol('FINANCE_DASHBOARD');

/** Uma baixa na janela, com a empresa e a direção do título — o insumo dos cards. */
export interface DashboardSettlementRow {
  companyId: string;
  direction: 'receivable' | 'payable';
  /** principal + juros + multa − desconto — o dinheiro que efetivamente entrou/saiu. */
  cashAmount: number;
  settledAt: Date;
}

/** Um título em aberto (open/partial), com vencimento — para vencidos e a vencer. */
export interface DashboardOpenTitleRow {
  companyId: string;
  direction: 'receivable' | 'payable';
  openAmount: number;
  dueDate: Date;
}

/**
 * A LEITURA do dashboard (05 fatia 5) — só consulta, escopada por tenant (filtro global + RLS).
 * Devolve LINHAS, não números prontos: a agregação (janela atual × anterior, por empresa e total)
 * é do use case, testável sem banco.
 */
export interface FinanceDashboardPort {
  settlementsBetween(from: Date, to: Date): Promise<DashboardSettlementRow[]>;
  openTitles(): Promise<DashboardOpenTitleRow[]>;
}
