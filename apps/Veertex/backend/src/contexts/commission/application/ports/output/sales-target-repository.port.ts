import { SalesTarget } from '../../../domain/entities/sales-target.entity';

export const SALES_TARGET_REPOSITORY = Symbol('SALES_TARGET_REPOSITORY');

export interface SalesTargetRepositoryPort {
  findByUserPeriod(userId: string, period: string): Promise<SalesTarget | null>;
  /** Metas do período (todos os vendedores) — para a tela de metas. */
  listByPeriod(period: string): Promise<SalesTarget[]>;
  /** Upsert por `(userId, period)` — pedir de novo o mesmo par substitui a meta. */
  save(target: SalesTarget): Promise<SalesTarget>;
}
