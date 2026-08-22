import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  ListMovementsFilter,
  StockMovementRepositoryPort,
} from '../../../../contexts/stock/application/ports/output/stock-movement-repository.port';
import { StockMovement } from '../../../../contexts/stock/domain/entities/stock-movement.entity';
import { StockMovementOrmEntity } from '../entities/stock-movement-orm.entity';
import { StockMovementMapper } from '../mappers/stock-movement.mapper';

/**
 * Repositório de movimentos de estoque. Sem `accountId` nos métodos — filtro global + RLS escopam.
 * Só INSERT e SELECT: movimento é append-only (§2.7), nunca UPDATE nem DELETE.
 */
@Injectable()
export class MikroOrmStockMovementRepository implements StockMovementRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: StockMovementMapper,
  ) {}

  /** Ordem CRONOLÓGICA — é o que o fold do saldo exige (a média móvel depende da ordem). */
  async listByCompanyProduct(companyId: string, productId: string): Promise<StockMovement[]> {
    const rows = await this.em.find(
      StockMovementOrmEntity,
      { companyId, productId },
      { orderBy: { occurredAt: 'ASC', createdAt: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(id: string): Promise<StockMovement | null> {
    const orm = await this.em.findOne(StockMovementOrmEntity, { id });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(movement: StockMovement): Promise<StockMovement> {
    const orm = this.em.create(StockMovementOrmEntity, {
      id: movement.id,
      accountId: movement.accountId,
      companyId: movement.companyId,
      productId: movement.productId,
      type: movement.type,
      signedQuantity: movement.signedQuantity.toFixed(3),
      unitCost: movement.unitCost === null ? null : movement.unitCost.toFixed(4),
      relatedMovementId: movement.relatedMovementId,
      usedFallback: movement.usedFallback,
      note: movement.note,
      occurredAt: movement.occurredAt,
      createdAt: movement.createdAt,
      updatedAt: movement.createdAt,
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }

  async list(filter: ListMovementsFilter): Promise<StockMovement[]> {
    const rows = await this.em.find(
      StockMovementOrmEntity,
      {
        ...(filter.companyId ? { companyId: filter.companyId } : {}),
        ...(filter.productId ? { productId: filter.productId } : {}),
        ...(filter.type ? { type: filter.type } : {}),
      },
      { orderBy: { occurredAt: 'DESC', createdAt: 'DESC' }, limit: 200 },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }
}
