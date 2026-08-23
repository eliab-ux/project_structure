import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ListTripsFilter,
  TRIP_REPOSITORY,
  TripRepositoryPort,
} from '../../ports/output/trip-repository.port';
import { TripDto } from '../../dto/trip.dto';

export class ListTripsQuery {
  constructor(public readonly filter: ListTripsFilter = {}) {}
}

/** Lista viagens (§2 do 04) — por rota, representante ou situação. */
@Injectable()
export class ListTripsUseCase implements UseCase<ListTripsQuery, TripDto[]> {
  constructor(@Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort) {}

  async execute(query: ListTripsQuery): Promise<TripDto[]> {
    const trips = await this.trips.list(query.filter);
    return trips.map(TripDto.fromDomain);
  }
}
