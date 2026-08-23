import { FinancialTitle } from '../../../domain/entities/financial-title.entity';
import { TitleDirection } from '../../../domain/title-enums';

export const FINANCIAL_TITLE_REPOSITORY = Symbol('FINANCIAL_TITLE_REPOSITORY');

export interface ListTitlesFilter {
  direction?: TitleDirection | null;
  companyId?: string | null;
  contactId?: string | null;
  status?: string | null;
}

export interface FinancialTitleRepositoryPort {
  findById(id: string): Promise<FinancialTitle | null>;
  list(filter: ListTitlesFilter): Promise<FinancialTitle[]>;
  /** Cria/atualiza o título e sincroniza as baixas (append: baixa nunca é removida). */
  save(title: FinancialTitle): Promise<FinancialTitle>;
}
