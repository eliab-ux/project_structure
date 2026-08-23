import { FinancialCategory } from '../../../domain/entities/financial-category.entity';

export const FINANCIAL_CATEGORY_REPOSITORY = Symbol('FINANCIAL_CATEGORY_REPOSITORY');

export interface FinancialCategoryRepositoryPort {
  findById(id: string): Promise<FinancialCategory | null>;
  list(includeInactive: boolean): Promise<FinancialCategory[]>;
  /** A categoria padrão de uma operação (§2.4) — usada para classificar lançamentos automáticos. */
  findByDefaultOperation(operation: string): Promise<FinancialCategory | null>;
  save(category: FinancialCategory): Promise<FinancialCategory>;
  /** Persiste o seed inicial em bloco (onboarding). */
  saveAll(categories: FinancialCategory[]): Promise<void>;
}
