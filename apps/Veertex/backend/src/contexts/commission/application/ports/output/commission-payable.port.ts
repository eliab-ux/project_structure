export const COMMISSION_PAYABLE = Symbol('COMMISSION_PAYABLE');

export interface CommissionPayableRequest {
  accountId: string;
  salesRepId: string;
  period: string;
  /** Empresa que PAGA a comissão — o título pertence a uma empresa (§2.6). O operador escolhe. */
  companyId: string;
  amount: number;
}

/**
 * Materializa a comissão apurada como **conta a pagar no FIN** (§2 do 02A / §2.2 do 05 — padrão
 * Bling). Retorna o id do título criado. Antes o FIN não existia e isto era no-op; agora o adapter
 * cria um `financial_title` a pagar, categorizado pela categoria padrão da operação `commission`.
 */
export interface CommissionPayablePort {
  materialize(request: CommissionPayableRequest): Promise<string>;
}
