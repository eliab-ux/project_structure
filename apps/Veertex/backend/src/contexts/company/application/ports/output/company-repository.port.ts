import { Company } from '../../../domain/entities/company.entity';
import { CompanyId } from '../../../domain/value-objects/company-id.vo';

export const COMPANY_REPOSITORY = Symbol('COMPANY_REPOSITORY');

/**
 * Note the absence of an `accountId` parameter anywhere: every read is scoped by the global tenant
 * filter and by RLS. There is nothing to forget and nothing to spoof.
 */
export interface CompanyRepositoryPort {
  findById(id: CompanyId): Promise<Company | null>;
  findByDocument(document: string): Promise<Company | null>;
  listAll(): Promise<Company[]>;
  countAll(): Promise<number>;
  countActive(): Promise<number>;
  save(company: Company): Promise<Company>;
}
