import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { AccountPreferencesReader } from '../../../../account/application/account-preferences.reader';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepositoryPort,
} from '../../../../stock/application/ports/output/stock-movement-repository.port';
import {
  STOCK_LOCATION_REPOSITORY,
  StockLocationRepositoryPort,
} from '../../../../stock/application/ports/output/stock-location-repository.port';
import {
  STOCK_PRODUCT_LOOKUP,
  StockProductLookupPort,
} from '../../../../stock/application/ports/output/stock-product-lookup.port';
import { StockMovement } from '../../../../stock/domain/entities/stock-movement.entity';
import { StockLocation } from '../../../../stock/domain/entities/stock-location.entity';
import { computeBalance } from '../../../../stock/domain/stock-balance';
import {
  NegativeStockNotAllowedException,
  StockLocationInvalidException,
  StockProductInvalidException,
} from '../../../../stock/domain/exceptions/stock-exceptions';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import {
  CONSIGNMENT_FISCAL,
  ConsignmentFiscalPort,
} from '../../ports/output/consignment-fiscal.port';
import { TripDto } from '../../dto/trip.dto';
import { TripNotFoundException } from '../../../domain/exceptions/route-exceptions';

export interface CargoLineInput {
  productId: string;
  quantity: number;
}

export class LoadTripCargoCommand {
  constructor(
    public readonly accountId: string,
    public readonly tripId: string,
    /** Depósito de ORIGEM (warehouse) de onde a carga sai. */
    public readonly fromLocationId: string,
    public readonly lines: CargoLineInput[],
  ) {}
}

/**
 * Carga da viagem — o romaneio (§3.1 do 04): transferência `warehouse → rep_load`, item a item, como
 * PARES atômicos de movimentos na mesma transação:
 *
 *  - saída no depósito: tipo **`trip_load`** (o tipo reservado do 03A chega aqui, no seu módulo dono);
 *  - entrada na carga: **`transfer_in`** apontando a saída (`relatedMovementId`) — o par é rastreável.
 *
 * Ambos ao **custo médio vigente da empresa** (a média não se move; só muda a distribuição — mesma
 * regra da transferência interna do 03A §2.4). A localização `rep_load` da viagem é criada na
 * PRIMEIRA carga e fica na trip. O negativo é aferido na ORIGEM. Sem documento fiscal: quando o FIS
 * existir, a `remessa em consignação` sai pelo `ConsignmentFiscalPort` (hoje no-op — 07 §2).
 *
 * Só viagem `planejada` aceita carga (guard do domínio).
 */
@Injectable()
export class LoadTripCargoUseCase implements UseCase<LoadTripCargoCommand, TripDto> {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepositoryPort,
    @Inject(STOCK_LOCATION_REPOSITORY) private readonly locations: StockLocationRepositoryPort,
    @Inject(STOCK_PRODUCT_LOOKUP) private readonly products: StockProductLookupPort,
    @Inject(CONSIGNMENT_FISCAL) private readonly fiscal: ConsignmentFiscalPort,
    private readonly preferences: AccountPreferencesReader,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: LoadTripCargoCommand): Promise<TripDto> {
    return this.uow.execute(async () => {
      const trip = await this.trips.findById(command.tripId);
      if (!trip) {
        throw new TripNotFoundException();
      }
      trip.assertAcceptsCargo();

      const from = await this.locations.findById(command.fromLocationId);
      if (!from || from.companyId !== trip.companyId || !from.active) {
        throw new StockLocationInvalidException(
          'Depósito de origem não encontrado, de outra empresa, ou inativo.',
        );
      }

      // A localização da carga (`rep_load`) nasce na primeira carga da viagem.
      let loadLocationId = trip.loadLocationId;
      if (!loadLocationId) {
        const created = await this.locations.save(
          StockLocation.create({
            accountId: command.accountId,
            companyId: trip.companyId,
            kind: 'rep_load',
            name: `Carga da viagem ${trip.id.slice(0, 8)}`,
          }),
        );
        loadLocationId = created.id;
        trip.attachLoadLocation(loadLocationId);
      }

      const prefs = await this.preferences.forAccount(command.accountId);

      for (const line of command.lines) {
        const quantity = Math.abs(line.quantity);
        if (quantity === 0) {
          continue;
        }
        const product = await this.products.findById(line.productId);
        if (!product || !product.active) {
          throw new StockProductInvalidException('Produto não encontrado ou inativo.');
        }
        if (product.isBundle) {
          throw new StockProductInvalidException(
            `Kit "${product.name}" não tem saldo próprio para carregar — carregue os componentes.`,
          );
        }

        // Custo médio da EMPRESA (todas as localizações) — o par não move a média (03A §2.4).
        const companyMovements = await this.movements.listByCompanyProduct(
          trip.companyId,
          line.productId,
        );
        const company = computeBalance(companyMovements.map((m) => m.toBalanceInput()));

        // Negativo aferido na ORIGEM.
        const originMovements = await this.movements.listByCompanyProductLocation(
          trip.companyId,
          line.productId,
          command.fromLocationId,
        );
        const origin = computeBalance(originMovements.map((m) => m.toBalanceInput()));
        if (origin.quantity - quantity < 0 && !prefs.stockAllowNegative) {
          throw new NegativeStockNotAllowedException(
            origin.quantity.toString(),
            quantity.toString(),
          );
        }

        const out = await this.movements.save(
          StockMovement.create({
            accountId: command.accountId,
            companyId: trip.companyId,
            productId: line.productId,
            locationId: command.fromLocationId,
            type: 'trip_load',
            signedQuantity: quantity,
            unitCost: company.averageCost,
            note: `Carga da viagem ${trip.id}`,
          }),
        );
        await this.movements.save(
          StockMovement.create({
            accountId: command.accountId,
            companyId: trip.companyId,
            productId: line.productId,
            locationId: loadLocationId,
            type: 'transfer_in',
            signedQuantity: quantity,
            unitCost: company.averageCost,
            relatedMovementId: out.id,
            note: `Carga da viagem ${trip.id}`,
          }),
        );
      }

      // Fronteira ROT↔FIS (07 §2): remessa em consignação. No-op até o FIS existir.
      await this.fiscal.emitConsignmentShipment({
        tripId: trip.id,
        companyId: trip.companyId,
        fromLocationId: command.fromLocationId,
        toLocationId: loadLocationId,
        lines: command.lines,
      });

      const saved = await this.trips.save(trip);
      return TripDto.fromDomain(saved);
    });
  }
}
