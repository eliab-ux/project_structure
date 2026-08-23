import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { FieldReceiptRepositoryPort } from '../../../../contexts/route/application/ports/output/field-receipt-repository.port';
import { FieldReceipt } from '../../../../contexts/route/domain/entities/field-receipt.entity';
import { FieldReceiptOrmEntity } from '../entities/field-receipt-orm.entity';

@Injectable()
export class MikroOrmFieldReceiptRepository implements FieldReceiptRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: FieldReceiptOrmEntity): FieldReceipt {
    return FieldReceipt.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      tripId: orm.tripId,
      titleId: orm.titleId,
      method: orm.method,
      amount: orm.amount,
      interest: orm.interest,
      insideWallet: orm.insideWallet,
      status: orm.status,
      effectuatedAt: orm.effectuatedAt,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<FieldReceipt | null> {
    const orm = await this.em.findOne(FieldReceiptOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async listByTrip(tripId: string): Promise<FieldReceipt[]> {
    const rows = await this.em.find(
      FieldReceiptOrmEntity,
      { tripId },
      { orderBy: { createdAt: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async findByClientUuid(clientUuid: string): Promise<FieldReceipt | null> {
    const orm = await this.em.findOne(FieldReceiptOrmEntity, { clientUuid });
    return orm ? this.toDomain(orm) : null;
  }

  async save(
    receipt: FieldReceipt,
    options?: { clientUuid?: string | null },
  ): Promise<FieldReceipt> {
    const existing = await this.em.findOne(FieldReceiptOrmEntity, { id: receipt.id });
    if (existing) {
      existing.status = receipt.status;
      existing.effectuatedAt = receipt.effectuatedAt;
      existing.updatedAt = new Date();
      await this.em.flush();
      return this.toDomain(existing);
    }
    const orm = this.em.create(FieldReceiptOrmEntity, {
      id: receipt.id,
      accountId: receipt.accountId,
      tripId: receipt.tripId,
      titleId: receipt.titleId,
      method: receipt.method,
      amount: receipt.amount.toFixed(2),
      interest: receipt.interest.toFixed(2),
      insideWallet: receipt.insideWallet,
      status: receipt.status,
      clientUuid: options?.clientUuid ?? null,
      effectuatedAt: receipt.effectuatedAt,
      createdAt: receipt.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
