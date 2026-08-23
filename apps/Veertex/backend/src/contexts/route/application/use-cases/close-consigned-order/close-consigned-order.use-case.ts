import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  ORDER_REPOSITORY,
  OrderRepositoryPort,
} from '../../../../order/application/ports/output/order-repository.port';
import { OrderId } from '../../../../order/domain/value-objects/order-id.vo';
import { OrderDto } from '../../../../order/application/dto/order.dto';
import { OrderNotFoundException } from '../../../../order/domain/exceptions/order-exceptions';
import {
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepositoryPort,
} from '../../../../stock/application/ports/output/stock-movement-repository.port';
import { StockMovement } from '../../../../stock/domain/entities/stock-movement.entity';
import { computeBalance } from '../../../../stock/domain/stock-balance';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import {
  CONSIGNMENT_FISCAL,
  ConsignmentFiscalPort,
} from '../../ports/output/consignment-fiscal.port';
import {
  TripMismatchException,
  TripNotFoundException,
} from '../../../domain/exceptions/route-exceptions';

export interface SoldLineInput {
  productId: string;
  quantity: number;
}

export class CloseConsignedOrderCommand {
  constructor(
    public readonly accountId: string,
    public readonly orderId: string,
    /**
     * Linhas efetivamente VENDIDAS. Ausente → os itens do pedido inteiros. A retaguarda que
     * registrou devolução/troca informa o vendido real — os itens do pedido são imutáveis fora do
     * rascunho, e baixar o total após uma devolução baixaria duas vezes.
     */
    public readonly soldLines?: SoldLineInput[] | null,
  ) {}
}

/**
 * FECHA o pedido consignado (em_acerto → fechado, §3.2 do 04): **a venda do consignado e a saída
 * física da carga são o MESMO evento de negócio** (semântica confirmada pelo Eliab) — no mesmo ponto:
 *
 *  1. `sale_out @rep_load` por linha vendida, ao custo médio da empresa (§3.4 do 03);
 *  2. `emitConsignedSale` (fronteira ROT↔FIS, natureza "venda de mercadoria consignada" — no-op até
 *     o FIS existir);
 *  3. a transição `closeConsignment()` do pedido.
 */
@Injectable()
export class CloseConsignedOrderUseCase implements UseCase<CloseConsignedOrderCommand, OrderDto> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepositoryPort,
    @Inject(CONSIGNMENT_FISCAL) private readonly fiscal: ConsignmentFiscalPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CloseConsignedOrderCommand): Promise<OrderDto> {
    return this.uow.execute(async () => {
      const order = await this.orders.findById(OrderId.from(command.orderId));
      if (!order) {
        throw new OrderNotFoundException(command.orderId);
      }
      if (!order.tripId) {
        throw new TripMismatchException('Pedido consignado precisa de uma viagem (tripId).');
      }
      const trip = await this.trips.findById(order.tripId);
      if (!trip || !trip.loadLocationId) {
        throw new TripNotFoundException();
      }

      const lines: SoldLineInput[] =
        command.soldLines && command.soldLines.length > 0
          ? command.soldLines
          : order.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));

      // 1) Baixa física da carga: sale_out @rep_load ao custo médio da época (§3.4 do 03).
      for (const line of lines) {
        const quantity = Math.abs(line.quantity);
        if (quantity === 0) continue;
        const companyMovements = await this.movements.listByCompanyProduct(
          trip.companyId,
          line.productId,
        );
        const averageCost = computeBalance(
          companyMovements.map((m) => m.toBalanceInput()),
        ).averageCost;
        await this.movements.save(
          StockMovement.create({
            accountId: command.accountId,
            companyId: trip.companyId,
            productId: line.productId,
            locationId: trip.loadLocationId,
            type: 'sale_out',
            signedQuantity: quantity,
            unitCost: averageCost,
            note: `Venda de consignado — pedido ${order.number}, viagem ${trip.id}`,
          }),
        );
      }

      // 2) Fronteira ROT↔FIS: venda de mercadoria consignada (no-op até o FIS existir).
      await this.fiscal.emitConsignedSale({
        tripId: trip.id,
        orderId: order.id.value,
        contactId: order.contactId,
        companyId: trip.companyId,
        lines,
      });

      // 3) A transição — a venda se conclui.
      order.closeConsignment();
      return OrderDto.fromDomain(await this.orders.save(order));
    });
  }
}
