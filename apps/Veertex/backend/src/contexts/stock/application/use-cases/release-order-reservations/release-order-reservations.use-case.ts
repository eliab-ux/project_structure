import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  STOCK_RESERVATION_REPOSITORY,
  StockReservationRepositoryPort,
} from '../../ports/output/stock-reservation-repository.port';
import { ReleaseReason } from '../../../domain/entities/stock-reservation.entity';

export class ReleaseOrderReservationsCommand {
  constructor(
    public readonly orderId: string,
    public readonly reason: ReleaseReason,
  ) {}
}

/**
 * Libera as reservas ativas de um pedido (§3.9) — cancelamento (`cancelled`) ou faturamento
 * (`invoiced`, que chega com EST/FIN/FIS). Idempotente: reserva já liberada não muda.
 */
@Injectable()
export class ReleaseOrderReservationsUseCase implements UseCase<
  ReleaseOrderReservationsCommand,
  void
> {
  constructor(
    @Inject(STOCK_RESERVATION_REPOSITORY)
    private readonly reservations: StockReservationRepositoryPort,
  ) {}

  async execute(command: ReleaseOrderReservationsCommand): Promise<void> {
    const active = await this.reservations.findActiveByOrder(command.orderId);
    if (active.length === 0) {
      return;
    }
    active.forEach((reservation) => reservation.release(command.reason));
    await this.reservations.saveReleases(active);
  }
}
