import { PaymentCondition } from '../../../domain/entities/payment-condition.entity';

export const PAYMENT_CONDITION_REPOSITORY = Symbol('PAYMENT_CONDITION_REPOSITORY');

export interface PaymentConditionRepositoryPort {
  findById(id: string): Promise<PaymentCondition | null>;
  /** Todas as condições da conta (o filtro de tenant + RLS escopam). */
  list(includeInactive: boolean): Promise<PaymentCondition[]>;
  save(condition: PaymentCondition): Promise<PaymentCondition>;
}
