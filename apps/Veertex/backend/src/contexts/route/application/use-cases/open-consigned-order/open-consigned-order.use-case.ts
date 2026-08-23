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
  CreateFinancialTitleCommand,
  CreateFinancialTitleUseCase,
} from '../../../../finance/application/use-cases/create-financial-title/create-financial-title.use-case';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import { ROUTE_REPOSITORY, RouteRepositoryPort } from '../../ports/output/route-repository.port';
import {
  TripMismatchException,
  TripNotFoundException,
} from '../../../domain/exceptions/route-exceptions';

export class OpenConsignedOrderCommand {
  constructor(
    public readonly accountId: string,
    public readonly orderId: string,
  ) {}
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * EFETIVA o pedido consignado (rascunho → consignado_aberto, §3.3 do 04) e faz nascer o TÍTULO da
 * consignação no FIN (§2.1(b) do 05, momento confirmado pelo Eliab): a receber, origem
 * `consignment`, valor = total do pedido, **vencimento = saída da viagem + `cycle_days` da rota**
 * (~60 dias — a "próxima passagem"; viagem ainda planejada → base = agora). O lançamento manual
 * continua possível para avulsos.
 */
@Injectable()
export class OpenConsignedOrderUseCase implements UseCase<OpenConsignedOrderCommand, OrderDto> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepositoryPort,
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(ROUTE_REPOSITORY) private readonly routes: RouteRepositoryPort,
    private readonly createTitle: CreateFinancialTitleUseCase,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: OpenConsignedOrderCommand): Promise<OrderDto> {
    return this.uow.execute(async () => {
      const order = await this.orders.findById(OrderId.from(command.orderId));
      if (!order) {
        throw new OrderNotFoundException(command.orderId);
      }
      if (!order.tripId) {
        throw new TripMismatchException('Pedido consignado precisa de uma viagem (tripId).');
      }
      const trip = await this.trips.findById(order.tripId);
      if (!trip) {
        throw new TripNotFoundException();
      }
      const route = await this.routes.findById(trip.routeId);
      const cycleDays = route?.cycleDays ?? 60;

      order.openConsignment(); // guarda de domínio: só origin='rota', com itens

      const base = trip.departureAt ?? new Date();
      const dueDate = new Date(base.getTime() + cycleDays * MS_PER_DAY);
      await this.createTitle.execute(
        new CreateFinancialTitleCommand(command.accountId, 'receivable', {
          companyId: order.companyId,
          contactId: order.contactId,
          description: `Consignação — pedido ${order.number}`,
          amount: order.total,
          dueDate,
          origin: 'consignment',
        }),
      );

      return OrderDto.fromDomain(await this.orders.save(order));
    });
  }
}
