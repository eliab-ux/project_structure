import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import { TripDto } from '../../dto/trip.dto';
import { TripNotFoundException } from '../../../domain/exceptions/route-exceptions';

export type TripStatusAction = 'depart' | 'arrive' | 'cancel';

export class ChangeTripStatusCommand {
  constructor(
    public readonly tripId: string,
    public readonly action: TripStatusAction,
    /** Na chegada (`arrive`): caixa de retorno e km final, se já contados. */
    public readonly input: { returnCash?: number | null; finalKm?: number | null } = {},
  ) {}
}

/**
 * Move a situação da viagem (§2 do 04): `depart` (saiu), `arrive` (voltou → em_fechamento) e
 * `cancel`. O `close` (fechamento) NÃO está aqui — é o `CloseTrip` da fatia 5, que dispara o
 * batimento e a folha de comissões.
 */
@Injectable()
export class ChangeTripStatusUseCase implements UseCase<ChangeTripStatusCommand, TripDto> {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ChangeTripStatusCommand): Promise<TripDto> {
    return this.uow.execute(async () => {
      const trip = await this.trips.findById(command.tripId);
      if (!trip) {
        throw new TripNotFoundException();
      }
      switch (command.action) {
        case 'depart':
          trip.depart();
          break;
        case 'arrive':
          trip.arrive({ returnCash: command.input.returnCash, finalKm: command.input.finalKm });
          break;
        case 'cancel':
          trip.cancel();
          break;
      }
      const saved = await this.trips.save(trip);
      return TripDto.fromDomain(saved);
    });
  }
}
