export const ROT_WALLET_PARAMS = Symbol('ROT_WALLET_PARAMS');

/**
 * Parâmetros da carteira por CONTA (§3.4 do 04). `recollectionLimit` = quantas RECOBRANÇAS depois da
 * cobrança inicial antes de o título virar "perdida" (default 3 — a política real "1+3").
 */
export interface RotWalletParamsPort {
  recollectionLimit(): Promise<number>;
}
