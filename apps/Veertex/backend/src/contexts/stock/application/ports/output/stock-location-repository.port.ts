import { StockLocation } from '../../../domain/entities/stock-location.entity';

export const STOCK_LOCATION_REPOSITORY = Symbol('STOCK_LOCATION_REPOSITORY');

export interface StockLocationRepositoryPort {
  findById(id: string): Promise<StockLocation | null>;
  listByCompany(companyId: string): Promise<StockLocation[]>;
  /** A localização default (`warehouse`) da empresa — criada no onboarding de cada empresa. */
  findDefaultWarehouse(companyId: string): Promise<StockLocation | null>;
  save(location: StockLocation): Promise<StockLocation>;
}
