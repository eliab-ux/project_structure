import { PriceList } from '../../../domain/entities/price-list.entity';

export const PRICE_LIST_REPOSITORY = Symbol('PRICE_LIST_REPOSITORY');

export interface PriceListRepositoryPort {
  findById(id: string): Promise<PriceList | null>;
  /** Todas as tabelas da conta (o filtro de tenant + RLS escopam). */
  list(includeInactive: boolean): Promise<PriceList[]>;
  /** Tabelas ATIVAS vinculadas a um contato — a resolução por contato (§3.2). */
  findActiveByContact(contactId: string): Promise<PriceList[]>;
  /** Tabelas ATIVAS vinculadas a um vendedor — a resolução por vendedor (§3.2). */
  findActiveBySalesRep(salesRepId: string): Promise<PriceList[]>;
  save(priceList: PriceList): Promise<PriceList>;
}
