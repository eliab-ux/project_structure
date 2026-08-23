import { CommissionTier } from '../../../domain/model-a';

export const COMMISSION_TIER_REPOSITORY = Symbol('COMMISSION_TIER_REPOSITORY');

/**
 * Faixas do Modelo A, customizáveis por CONTA (§2 do 02A). Guardadas como conjunto — substituir
 * troca todas de uma vez (não há edição parcial de faixa).
 */
export interface CommissionTierRepositoryPort {
  getForAccount(): Promise<CommissionTier[]>;
  replaceForAccount(accountId: string, tiers: CommissionTier[]): Promise<CommissionTier[]>;
}
