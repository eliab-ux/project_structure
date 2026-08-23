import { Trip } from '../../../domain/entities/trip.entity';

export const TRIP_REPOSITORY = Symbol('TRIP_REPOSITORY');

export interface ListTripsFilter {
  routeId?: string | null;
  salesRepId?: string | null;
  status?: string | null;
}

export interface TripRepositoryPort {
  findById(id: string): Promise<Trip | null>;
  list(filter: ListTripsFilter): Promise<Trip[]>;
  save(trip: Trip): Promise<Trip>;
}
