import { Plan } from '../../../domain/entities/plan.entity';

export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');

/**
 * Plans are global, so — unlike every tenant repository — these reads are not scoped and that is
 * correct rather than an oversight. The runtime role has SELECT on `plans` and nothing else.
 */
export interface PlanRepositoryPort {
  findById(id: string): Promise<Plan | null>;
  findByCode(code: string): Promise<Plan | null>;
  listActive(): Promise<Plan[]>;
}
