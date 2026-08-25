import { Withdrawal } from '../../../domain/entities/withdrawal.entity';
import { WithdrawalId } from '../../../domain/value-objects/withdrawal-id.vo';
import { WithdrawalStatusValue } from '../../../domain/value-objects/withdrawal-status.vo';
import { ResellerId } from '@contexts/reseller/domain/value-objects/reseller-id.vo';

export const WITHDRAWAL_REPOSITORY = Symbol('WITHDRAWAL_REPOSITORY');

export interface WithdrawalRepositoryPort {
  save(withdrawal: Withdrawal): Promise<Withdrawal>;
  findById(id: WithdrawalId): Promise<Withdrawal | null>;
  findByStatus(
    status: WithdrawalStatusValue,
    options?: { limit?: number; offset?: number },
  ): Promise<Withdrawal[]>;
  findByReseller(resellerId: ResellerId): Promise<Withdrawal[]>;
  hasPendingWithdrawal(resellerId: ResellerId): Promise<boolean>;
}
