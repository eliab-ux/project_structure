import { CommissionTier } from '../../../domain/model-a';

export const COMMISSION_B_TIER_REPOSITORY = Symbol('COMMISSION_B_TIER_REPOSITORY');

/**
 * Faixas do Modelo B, customizáveis por CONTA (§2.2 do 02A). Mesmo formato das do A (par
 * "faixa % → % de comissão"); a semântica difere (razão de RECEBIMENTO, % direto).
 */
export interface CommissionBTierRepositoryPort {
  getForAccount(): Promise<CommissionTier[]>;
  replaceForAccount(accountId: string, tiers: CommissionTier[]): Promise<CommissionTier[]>;
}

/** Faixas REAIS da operação (02A §2.2) — o default quando a conta não customizou. */
export const DEFAULT_MODEL_B_TIERS: readonly CommissionTier[] = [
  { thresholdPercent: 50, commissionPercent: 6 },
  { thresholdPercent: 70, commissionPercent: 7 },
  { thresholdPercent: 90, commissionPercent: 8 },
];
