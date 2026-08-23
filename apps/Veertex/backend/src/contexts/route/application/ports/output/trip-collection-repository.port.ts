import { TripCollection } from '../../../domain/entities/trip-collection.entity';

export const TRIP_COLLECTION_REPOSITORY = Symbol('TRIP_COLLECTION_REPOSITORY');

export interface TripCollectionRepositoryPort {
  listByTrip(tripId: string): Promise<TripCollection[]>;
  /** Quantas viagens JÁ cobraram este título (1 cobrança + N recobranças) — a régua da "perdida". */
  countByTitle(titleId: string): Promise<number>;
  /** O título já está na carteira desta viagem? (idempotência da montagem) */
  existsForTripTitle(tripId: string, titleId: string): Promise<boolean>;
  save(collection: TripCollection): Promise<TripCollection>;
}
