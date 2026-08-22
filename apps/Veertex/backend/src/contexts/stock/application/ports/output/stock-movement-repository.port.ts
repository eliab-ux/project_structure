import { StockMovement } from '../../../domain/entities/stock-movement.entity';

export const STOCK_MOVEMENT_REPOSITORY = Symbol('STOCK_MOVEMENT_REPOSITORY');

export interface ListMovementsFilter {
  companyId?: string | null;
  productId?: string | null;
  type?: string | null;
}

export interface StockMovementRepositoryPort {
  /** Todos os movimentos de um `(empresa, produto)`, EM ORDEM CRONOLÓGICA — a base do saldo derivado. */
  listByCompanyProduct(companyId: string, productId: string): Promise<StockMovement[]>;

  findById(id: string): Promise<StockMovement | null>;

  /** Append — o movimento é imutável; nunca há update de movimento. */
  save(movement: StockMovement): Promise<StockMovement>;

  /** Listagem para a tela (mais recentes primeiro). */
  list(filter: ListMovementsFilter): Promise<StockMovement[]>;
}
