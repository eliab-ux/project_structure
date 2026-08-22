import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { StockReservationRepositoryPort } from '../../../../contexts/stock/application/ports/output/stock-reservation-repository.port';
import { StockReservation } from '../../../../contexts/stock/domain/entities/stock-reservation.entity';
import { StockReservationOrmEntity } from '../entities/stock-reservation-orm.entity';
import { StockReservationMapper } from '../mappers/stock-reservation.mapper';

/**
 * Repositório de reservas. Sem `accountId` nos métodos — filtro global + RLS escopam. `save` insere;
 * `saveReleases` atualiza o status (liberação); nunca há DELETE.
 */
@Injectable()
export class MikroOrmStockReservationRepository implements StockReservationRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: StockReservationMapper,
  ) {}

  /** SUM das reservas ativas e NÃO vencidas — a expiração é preguiçosa (filtro `expires_at > now`). */
  async sumActiveReserved(companyId: string, productId: string, now: Date): Promise<number> {
    const rows = await this.em.find(StockReservationOrmEntity, {
      companyId,
      productId,
      status: 'active',
      expiresAt: { $gt: now },
    });
    return rows.reduce((sum, row) => sum + Number(row.quantity), 0);
  }

  async findActiveByOrder(orderId: string): Promise<StockReservation[]> {
    const rows = await this.em.find(StockReservationOrmEntity, { orderId, status: 'active' });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async save(reservation: StockReservation): Promise<void> {
    const orm = this.em.create(StockReservationOrmEntity, {
      id: reservation.id,
      accountId: reservation.accountId,
      companyId: reservation.companyId,
      productId: reservation.productId,
      orderId: reservation.orderId,
      quantity: reservation.quantity.toFixed(3),
      status: reservation.status,
      releaseReason: reservation.releaseReason,
      expiresAt: reservation.expiresAt,
      createdAt: reservation.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
  }

  async saveReleases(reservations: readonly StockReservation[]): Promise<void> {
    if (reservations.length === 0) {
      return;
    }
    const now = new Date();
    for (const reservation of reservations) {
      const orm = await this.em.findOne(StockReservationOrmEntity, { id: reservation.id });
      if (orm) {
        orm.status = reservation.status;
        orm.releaseReason = reservation.releaseReason;
        orm.updatedAt = now;
      }
    }
    await this.em.flush();
  }
}
