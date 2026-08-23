import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import { ROUTE_REPOSITORY, RouteRepositoryPort } from '../../ports/output/route-repository.port';
import { Trip } from '../../../domain/entities/trip.entity';
import { TripDto } from '../../dto/trip.dto';
import { RouteNotFoundException } from '../../../domain/exceptions/route-exceptions';

export class CreateTripCommand {
  constructor(
    public readonly accountId: string,
    public readonly input: {
      companyId: string;
      routeId: string;
      salesRepId: string;
      helperUserId?: string | null;
      initialCash?: number | null;
      initialKm?: number | null;
    },
  ) {}
}

/** Abre uma viagem (§2 do 04): rota × 1 representante (+ ajudante opcional), em `planejada`. */
@Injectable()
export class CreateTripUseCase implements UseCase<CreateTripCommand, TripDto> {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(ROUTE_REPOSITORY) private readonly routes: RouteRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateTripCommand): Promise<TripDto> {
    const route = await this.routes.findById(command.input.routeId);
    if (!route || !route.active) {
      throw new RouteNotFoundException();
    }
    const trip = Trip.create({
      accountId: command.accountId,
      companyId: command.input.companyId,
      routeId: command.input.routeId,
      salesRepId: command.input.salesRepId,
      helperUserId: command.input.helperUserId ?? null,
      initialCash: command.input.initialCash ?? 0,
      initialKm: command.input.initialKm ?? null,
    });
    return this.uow.execute(async () => {
      const saved = await this.trips.save(trip);
      return TripDto.fromDomain(saved);
    });
  }
}
