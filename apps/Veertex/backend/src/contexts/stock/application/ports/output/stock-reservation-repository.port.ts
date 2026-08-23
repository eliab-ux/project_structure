import { StockReservation } from '../../../domain/entities/stock-reservation.entity';

export const STOCK_RESERVATION_REPOSITORY = Symbol('STOCK_RESERVATION_REPOSITORY');

export interface StockReservationRepositoryPort {
  /** Soma das reservas ATIVAS e NÃO VENCIDAS de um `(empresa, produto)` — o que reduz o disponível. */
  sumActiveReserved(companyId: string, productId: string, now: Date): Promise<number>;

  /** Lista para a tela de reservas (02 §3.9) — filtros inline; tenant via filtro global + RLS. */
  list(filter: {
    companyId?: string | null;
    productId?: string | null;
    orderId?: string | null;
    status?: string | null;
  }): Promise<StockReservation[]>;

  /** Reservas ativas de um pedido, para liberar. */
  findActiveByOrder(orderId: string): Promise<StockReservation[]>;

  save(reservation: StockReservation): Promise<void>;

  /** Persiste alterações de status (liberação) de várias reservas. */
  saveReleases(reservations: readonly StockReservation[]): Promise<void>;
}
