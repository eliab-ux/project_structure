export const COMMISSION_PAYABLE = Symbol('COMMISSION_PAYABLE');

export interface CommissionPayable {
  accountId: string;
  salesRepId: string;
  period: string;
  amount: number;
  reference: string;
}

/**
 * Onde a comissão apurada vira **conta a pagar** (§2 do 02A — "comissão apurada gera contas a pagar
 * no FIN; padrão Bling").
 *
 * ## Fronteira declarada — o FIN não existe
 * Este port é o ponto de plugue. Enquanto o FIN não entra, o adapter é **no-op**: a apuração
 * calcula e devolve o valor, mas não há título a gerar. Quando o FIN chegar, troca-se o provider —
 * nada mais muda (mesmo desenho do `error_reporter`). Fire-and-forget: NUNCA lança.
 */
export interface CommissionPayablePort {
  emit(payable: CommissionPayable): void;
}
