import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  STOCK_RESERVATION_REPOSITORY,
  StockReservationRepositoryPort,
} from '../../ports/output/stock-reservation-repository.port';

export class ListStockReservationsQuery {
  constructor(
    public readonly filter: {
      companyId?: string | null;
      productId?: string | null;
      orderId?: string | null;
      status?: string | null;
    } = {},
  ) {}
}

export interface StockReservationDto {
  id: string;
  companyId: string;
  productId: string;
  orderId: string | null;
  quantity: number;
  status: string;
  releaseReason: string | null;
  expiresAt: string;
  createdAt: string;
  /** Marcada como expirada NESTA leitura — o evento visível acabou de acontecer. */
  expiredNow: boolean;
}

/**
 * Lista as reservas (02 §3.9) e faz a EXPIRAÇÃO VISÍVEL sem agendador (requisito do Eliab,
 * 22/08/2026: "reserva que some sozinha é o tipo de coisa que o vendedor descobre quando o cliente
 * cobra"): toda reserva ATIVA cujo prazo venceu é MARCADA `released/expired` nesta leitura —
 * persistida e auditável, nunca um TTL silencioso que só o cálculo de disponível conhecia. A tela
 * destaca as expiradas; o disponível já as ignorava (expiração preguiçosa), então marcar aqui não
 * muda saldo nenhum — muda a VISIBILIDADE.
 */
@Injectable()
export class ListStockReservationsUseCase implements UseCase<
  ListStockReservationsQuery,
  StockReservationDto[]
> {
  private readonly logger = new Logger(ListStockReservationsUseCase.name);

  constructor(
    @Inject(STOCK_RESERVATION_REPOSITORY)
    private readonly reservations: StockReservationRepositoryPort,
  ) {}

  async execute(query: ListStockReservationsQuery): Promise<StockReservationDto[]> {
    const rows = await this.reservations.list(query.filter);
    const now = new Date();

    const expiringNow = rows.filter(
      (reservation) =>
        reservation.status === 'active' && reservation.expiresAt.getTime() <= now.getTime(),
    );
    if (expiringNow.length > 0) {
      for (const reservation of expiringNow) {
        reservation.release('expired');
      }
      await this.reservations.saveReleases(expiringNow);
      this.logger.log('Reservas expiradas marcadas na leitura', { total: expiringNow.length });
    }
    const expiredIds = new Set(expiringNow.map((reservation) => reservation.id));

    return rows.map((reservation) => ({
      id: reservation.id,
      companyId: reservation.companyId,
      productId: reservation.productId,
      orderId: reservation.orderId,
      quantity: reservation.quantity,
      status: reservation.status,
      releaseReason: reservation.releaseReason,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      expiredNow: expiredIds.has(reservation.id),
    }));
  }
}
