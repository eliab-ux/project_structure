import { Visit } from '../../../domain/entities/visit.entity';

export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY');

export interface VisitRepositoryPort {
  save(visit: Visit): Promise<Visit>;
  countByResellerId(resellerId: string): Promise<number>;
  countByResellerIdSince(resellerId: string, since: Date): Promise<number>;
}
