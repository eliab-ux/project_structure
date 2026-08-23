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
import {
  STOCK_LOCATION_REPOSITORY,
  StockLocationRepositoryPort,
} from '../../../../stock/application/ports/output/stock-location-repository.port';
import { StockMovement } from '../../../../stock/domain/entities/stock-movement.entity';
import { computeBalance } from '../../../../stock/domain/stock-balance';
import { StockLocationInvalidException } from '../../../../stock/domain/exceptions/stock-exceptions';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import {
  CONSIGNMENT_FISCAL,
  ConsignmentFiscalPort,
} from '../../ports/output/consignment-fiscal.port';
import {
  TripMismatchException,
  TripNotFoundException,
} from '../../../domain/exceptions/route-exceptions';

export interface ReturnLineInput {
  productId: string;
  quantity: number;
}

export class ReturnConsignedItemsCommand {
  constructor(
    public readonly accountId: string,
    public readonly tripId: string,
    /** Depósito (warehouse) que recebe a devolução. */
    public readonly toLocationId: string,
    public readonly orderId: string | null,
    public readonly lines: ReturnLineInput[],
  ) {}
}

export interface ReturnConsignedItemsResult {
  movements: { productId: string; quantity: number; usedFallback: boolean }[];
}

/**
 * Devolução no acerto (§3.2 do 04): a mercadoria volta da carga ao depósito, como PAR atômico
 * `transfer_out @rep_load` + **`trip_return @warehouse`**. Reentra pelo **custo da época da CARGA**
 * (o `unitCost` estampado no `trip_load` desta viagem para o produto — aceite 5 do 04 / §3.4 do 03);
 * sem carga localizável → fallback para a média vigente, com `usedFallback` marcado (visível, não
 * silencioso). Fronteira ROT↔FIS: `retorno de consignação` (no-op até o FIS existir).
 */
@Injectable()
export class ReturnConsignedItemsUseCase implements UseCase<
  ReturnConsignedItemsCommand,
  ReturnConsignedItemsResult
> {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepositoryPort,
    @Inject(STOCK_LOCATION_REPOSITORY) private readonly locations: StockLocationRepositoryPort,
    @Inject(CONSIGNMENT_FISCAL) private readonly fiscal: ConsignmentFiscalPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ReturnConsignedItemsCommand): Promise<ReturnConsignedItemsResult> {
    return this.uow.execute(async () => {
      const trip = await this.trips.findById(command.tripId);
      if (!trip) {
        throw new TripNotFoundException();
      }
      if (!trip.loadLocationId) {
        throw new TripMismatchException('A viagem não tem carga — nada a devolver.');
      }

      const to = await this.locations.findById(command.toLocationId);
      if (!to || to.companyId !== trip.companyId || !to.active) {
        throw new StockLocationInvalidException(
          'Depósito de destino não encontrado, de outra empresa, ou inativo.',
        );
      }

      const result: ReturnConsignedItemsResult = { movements: [] };

      for (const line of command.lines) {
        const quantity = Math.abs(line.quantity);
        if (quantity === 0) {
          continue;
        }

        // Custo da ÉPOCA: o unitCost do trip_load desta viagem para o produto (a nota da carga).
        const loadMovements = await this.movements.listByCompanyProductLocation(
          trip.companyId,
          line.productId,
          trip.loadLocationId,
        );
        const loadIn = loadMovements.find((m) => m.type === 'transfer_in' && m.unitCost !== null);
        let unitCost: number;
        let usedFallback = false;
        if (loadIn && loadIn.unitCost !== null) {
          unitCost = loadIn.unitCost;
        } else {
          const companyMovements = await this.movements.listByCompanyProduct(
            trip.companyId,
            line.productId,
          );
          unitCost = computeBalance(companyMovements.map((m) => m.toBalanceInput())).averageCost;
          usedFallback = true;
        }

        const out = await this.movements.save(
          StockMovement.create({
            accountId: command.accountId,
            companyId: trip.companyId,
            productId: line.productId,
            locationId: trip.loadLocationId,
            type: 'transfer_out',
            signedQuantity: quantity,
            unitCost,
            note: `Devolução do acerto — viagem ${trip.id}`,
          }),
        );
        await this.movements.save(
          StockMovement.create({
            accountId: command.accountId,
            companyId: trip.companyId,
            productId: line.productId,
            locationId: command.toLocationId,
            type: 'trip_return',
            signedQuantity: quantity,
            unitCost,
            relatedMovementId: out.id,
            usedFallback,
            note: `Devolução do acerto — viagem ${trip.id}`,
          }),
        );
        result.movements.push({ productId: line.productId, quantity, usedFallback });
      }

      // Fronteira ROT↔FIS (07 §2): retorno de consignação. No-op até o FIS existir.
      await this.fiscal.emitConsignmentReturn({
        tripId: trip.id,
        orderId: command.orderId ?? '',
        companyId: trip.companyId,
        lines: command.lines,
      });

      return result;
    });
  }
}
