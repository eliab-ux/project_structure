import { Route } from '../../../domain/entities/route.entity';

export const ROUTE_REPOSITORY = Symbol('ROUTE_REPOSITORY');

export interface RouteRepositoryPort {
  findById(id: string): Promise<Route | null>;
  list(includeInactive: boolean): Promise<Route[]>;
  save(route: Route): Promise<Route>;
}
