import { FinancialAccount } from '../../../domain/entities/financial-account.entity';

export const FINANCIAL_ACCOUNT_REPOSITORY = Symbol('FINANCIAL_ACCOUNT_REPOSITORY');

export interface FinancialAccountRepositoryPort {
  findById(id: string): Promise<FinancialAccount | null>;
  list(includeInactive: boolean): Promise<FinancialAccount[]>;
  save(account: FinancialAccount): Promise<FinancialAccount>;
}
