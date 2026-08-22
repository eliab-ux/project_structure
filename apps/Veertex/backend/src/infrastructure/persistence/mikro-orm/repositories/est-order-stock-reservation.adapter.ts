import { Injectable } from '@nestjs/common';
import {
  OrderStockReservationPort,
  OrderReserveLine,
} from '../../../../contexts/order/application/ports/output/order-stock-reservation.port';
import {
  ReserveOrderStockCommand,
  ReserveOrderStockUseCase,
} from '../../../../contexts/stock/application/use-cases/reserve-order-stock/reserve-order-stock.use-case';
import {
  ReleaseOrderReservationsCommand,
  ReleaseOrderReservationsUseCase,
} from '../../../../contexts/stock/application/use-cases/release-order-reservations/release-order-reservations.use-case';

/**
 * O adapter do `OrderStockReservationPort` — liga o VND ao EST. Vive na infraestrutura de propósito:
 * é onde os dois contextos se encontram sem o VND importar o módulo EST. Delega aos MESMOS use cases
 * de reserva que o EST expõe; nenhuma regra vive aqui.
 *
 * A atomicidade vem da transação do request (o interceptor envolve tudo): se a reserva lançar por
 * falta de disponível, o `confirm` do pedido inteiro reverte junto.
 */
@Injectable()
export class EstOrderStockReservation implements OrderStockReservationPort {
  constructor(
    private readonly reserveOrderStock: ReserveOrderStockUseCase,
    private readonly releaseReservations: ReleaseOrderReservationsUseCase,
  ) {}

  async reserve(params: {
    accountId: string;
    companyId: string;
    orderId: string;
    lines: readonly OrderReserveLine[];
  }): Promise<void> {
    await this.reserveOrderStock.execute(
      new ReserveOrderStockCommand(
        params.accountId,
        params.companyId,
        params.orderId,
        params.lines,
      ),
    );
  }

  async release(orderId: string, reason: 'cancelled' | 'invoiced'): Promise<void> {
    await this.releaseReservations.execute(new ReleaseOrderReservationsCommand(orderId, reason));
  }
}
