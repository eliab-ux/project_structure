import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { OrderEvidenceRepositoryPort } from '../../../../contexts/route/application/ports/output/order-evidence-repository.port';
import { OrderEvidence } from '../../../../contexts/route/domain/entities/order-evidence.entity';
import { OrderEvidenceOrmEntity } from '../entities/order-evidence-orm.entity';

/** Evidências: só INSERT e SELECT — append-only (o GPS imutável é garantia do banco). */
@Injectable()
export class MikroOrmOrderEvidenceRepository implements OrderEvidenceRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: OrderEvidenceOrmEntity): OrderEvidence {
    return OrderEvidence.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      orderId: orm.orderId,
      tripId: orm.tripId,
      type: orm.type,
      latitude: orm.latitude,
      longitude: orm.longitude,
      objectKey: orm.objectKey,
      previousEvidenceId: orm.previousEvidenceId,
      changedByUserId: orm.changedByUserId,
      changeReason: orm.changeReason,
      capturedAt: orm.capturedAt,
      createdAt: orm.createdAt,
    });
  }

  async listByOrder(orderId: string): Promise<OrderEvidence[]> {
    const rows = await this.em.find(
      OrderEvidenceOrmEntity,
      { orderId },
      { orderBy: { createdAt: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async findCurrentGps(orderId: string): Promise<OrderEvidence | null> {
    const orm = await this.em.findOne(
      OrderEvidenceOrmEntity,
      { orderId, type: 'gps' },
      { orderBy: { createdAt: 'DESC' } },
    );
    return orm ? this.toDomain(orm) : null;
  }

  async findByClientUuid(clientUuid: string): Promise<OrderEvidence | null> {
    const orm = await this.em.findOne(OrderEvidenceOrmEntity, { clientUuid });
    return orm ? this.toDomain(orm) : null;
  }

  async save(
    evidence: OrderEvidence,
    options?: { clientUuid?: string | null },
  ): Promise<OrderEvidence> {
    const orm = this.em.create(OrderEvidenceOrmEntity, {
      clientUuid: options?.clientUuid ?? null,
      id: evidence.id,
      accountId: evidence.accountId,
      orderId: evidence.orderId,
      tripId: evidence.tripId,
      type: evidence.type,
      latitude: evidence.latitude === null ? null : evidence.latitude.toFixed(7),
      longitude: evidence.longitude === null ? null : evidence.longitude.toFixed(7),
      objectKey: evidence.objectKey,
      previousEvidenceId: evidence.previousEvidenceId,
      changedByUserId: evidence.changedByUserId,
      changeReason: evidence.changeReason,
      capturedAt: evidence.capturedAt,
      createdAt: evidence.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
