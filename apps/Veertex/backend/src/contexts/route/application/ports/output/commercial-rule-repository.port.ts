import { CommercialRule } from '../../../domain/entities/commercial-rule.entity';

export const COMMERCIAL_RULE_REPOSITORY = Symbol('COMMERCIAL_RULE_REPOSITORY');

export interface CommercialRuleRepositoryPort {
  findByUser(userId: string): Promise<CommercialRule | null>;
  /** Upsert por `userId` — uma regra por representante. */
  save(rule: CommercialRule): Promise<CommercialRule>;
}
