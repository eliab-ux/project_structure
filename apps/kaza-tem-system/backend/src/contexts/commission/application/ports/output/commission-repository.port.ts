import { Commission } from '../../../domain/entities/commission.entity';
import { CommissionRule } from '../../../domain/entities/commission-rule.entity';

export const COMMISSION_REPOSITORY = Symbol('COMMISSION_REPOSITORY');
export const COMMISSION_RULE_REPOSITORY = Symbol('COMMISSION_RULE_REPOSITORY');

export interface CommissionRepositoryPort {
  save(commission: Commission): Promise<Commission>;
  findReadyToRelease(): Promise<Commission[]>;
  getBalance(
    resellerId: string,
  ): Promise<{ pending: number; available: number; withdrawn: number; debt: number }>;
  getResellerMonthlySales(resellerId: string): Promise<number>;
  findByResellerId(
    resellerId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Commission[]>;
  findAll(options?: { status?: string[]; limit?: number; offset?: number }): Promise<Commission[]>;
  findByOrderId(orderId: string): Promise<Commission | null>;
  findAvailableByReseller(resellerId: string): Promise<Commission[]>;
  findByIds(ids: string[]): Promise<Commission[]>;
  deleteByOrderId(orderId: string): Promise<void>;
}

export interface CommissionRuleRepositoryPort {
  findActive(): Promise<CommissionRule[]>;
  findAll(): Promise<CommissionRule[]>;
  syncRules(rules: CommissionRule[]): Promise<void>;
}
