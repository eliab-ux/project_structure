export const COMMISSION_SALES_LOOKUP = Symbol('COMMISSION_SALES_LOOKUP');

/**
 * "Vendido" de um vendedor num período — a base do Modelo A. Soma o total dos pedidos do vendedor
 * cuja `referenceDate` cai no período.
 *
 * ## Fronteira declarada até o faturamento existir
 * O Modelo A apura no FATURAMENTO (§2 do 02A), mas `faturado` está bloqueado no V1. Até o FIS/EST
 * ligarem o faturamento, o "vendido" soma os pedidos já efetivados (`confirmado`/`concluido`) — é
 * apuração de PRÉVIA. Quando o faturamento entrar, a mesma soma passa a contar `faturado` e o número
 * vira definitivo, sem mudar a assinatura.
 */
export interface CommissionSalesLookupPort {
  sumSoldBySalesRep(salesRepId: string, period: string): Promise<number>;
}
