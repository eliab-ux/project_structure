import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepositoryPort,
} from '../../../../stock/application/ports/output/stock-movement-repository.port';
import { StockMovement } from '../../../../stock/domain/entities/stock-movement.entity';
import { computeBalance } from '../../../../stock/domain/stock-balance';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import {
  TripMismatchException,
  TripNotFoundException,
} from '../../../domain/exceptions/route-exceptions';

export class ExchangeConsignedItemsCommand {
  constructor(
    public readonly accountId: string,
    public readonly tripId: string,
    public readonly orderId: string | null,
    /** O item que a revendedora DEVOLVE na troca. */
    public readonly returnedProductId: string,
    public readonly returnedQuantity: number,
    /** O item que ela LEVA no lugar. */
    public readonly takenProductId: string,
    public readonly takenQuantity: number,
  ) {}
}

export interface ExchangeResult {
  inMovementId: string;
  outMovementId: string;
}

/**
 * Troca no acerto (§3.2 do 04): PAR VINCULADO `exchange_in` (o item devolvido reentra na carga,
 * disponível de novo) + `exchange_out` (o item levado sai da carga), ambos na `rep_load` da viagem,
 * ao custo médio da empresa. A DIFERENÇA de valor é acertada no financeiro do acerto (recebimento/
 * ajuste do título) — aqui é só o estoque. A saída aponta a entrada (`relatedMovementId`): o par é
 * rastreável — aceite 5 do 04.
 */
@Injectable()
export class ExchangeConsignedItemsUseCase implements UseCase<
  ExchangeConsignedItemsCommand,
  ExchangeResult
> {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ExchangeConsignedItemsCommand): Promise<ExchangeResult> {
    return this.uow.execute(async () => {
      const trip = await this.trips.findById(command.tripId);
      if (!trip) {
        throw new TripNotFoundException();
      }
      if (!trip.loadLocationId) {
        throw new TripMismatchException('A viagem não tem carga — não há o que trocar.');
      }

      const inCost = await this.companyAverage(trip.companyId, command.returnedProductId);
      const outCost = await this.companyAverage(trip.companyId, command.takenProductId);

      const inMovement = await this.movements.save(
        StockMovement.create({
          accountId: command.accountId,
          companyId: trip.companyId,
          productId: command.returnedProductId,
          locationId: trip.loadLocationId,
          type: 'exchange_in',
          signedQuantity: Math.abs(command.returnedQuantity),
          unitCost: inCost,
          note: `Troca do acerto — viagem ${trip.id}`,
        }),
      );
      const outMovement = await this.movements.save(
        StockMovement.create({
          accountId: command.accountId,
          companyId: trip.companyId,
          productId: command.takenProductId,
          locationId: trip.loadLocationId,
          type: 'exchange_out',
          signedQuantity: Math.abs(command.takenQuantity),
          unitCost: outCost,
          relatedMovementId: inMovement.id,
          note: `Troca do acerto — viagem ${trip.id}`,
        }),
      );

      return { inMovementId: inMovement.id, outMovementId: outMovement.id };
    });
  }

  private async companyAverage(companyId: string, productId: string): Promise<number> {
    const movements = await this.movements.listByCompanyProduct(companyId, productId);
    return computeBalance(movements.map((m) => m.toBalanceInput())).averageCost;
  }
}
