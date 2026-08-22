import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { StockLocationRepositoryPort } from '../../../../contexts/stock/application/ports/output/stock-location-repository.port';
import {
  StockLocation,
  StockLocationKind,
} from '../../../../contexts/stock/domain/entities/stock-location.entity';
import { StockLocationOrmEntity } from '../entities/stock-location-orm.entity';

@Injectable()
export class MikroOrmStockLocationRepository implements StockLocationRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  private toDomain(orm: StockLocationOrmEntity): StockLocation {
    return StockLocation.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      companyId: orm.companyId,
      kind: orm.kind as StockLocationKind,
      name: orm.name,
      active: orm.active,
      createdAt: orm.createdAt,
    });
  }

  async findById(id: string): Promise<StockLocation | null> {
    const orm = await this.em.findOne(StockLocationOrmEntity, { id });
    return orm ? this.toDomain(orm) : null;
  }

  async listByCompany(companyId: string): Promise<StockLocation[]> {
    const rows = await this.em.find(
      StockLocationOrmEntity,
      { companyId },
      { orderBy: { name: 'ASC' } },
    );
    return rows.map((row) => this.toDomain(row));
  }

  async findDefaultWarehouse(companyId: string): Promise<StockLocation | null> {
    const orm = await this.em.findOne(
      StockLocationOrmEntity,
      { companyId, kind: 'warehouse', active: true },
      { orderBy: { createdAt: 'ASC' } },
    );
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Cria a localização. É INSERT puro — sem o `findOne`-primeiro de um upsert, de propósito: o
   * onboarding (`create:account`) roda sob o papel OPERADOR, sem escopo de tenant estabelecido, e um
   * SELECT ali dispararia o filtro `tenant` sem `accountId`. Não há caminho de update de localização
   * nesta fatia (rename/deactivate ainda não têm use case); quando houver, ele lê no contexto de
   * request, onde o escopo existe, e chama um `update` explícito — não este `save`.
   */
  async save(location: StockLocation): Promise<StockLocation> {
    const orm = this.em.create(StockLocationOrmEntity, {
      id: location.id,
      accountId: location.accountId,
      companyId: location.companyId,
      kind: location.kind,
      name: location.name,
      active: location.active,
      createdAt: location.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    this.em.persist(orm);
    await this.em.flush();
    return this.toDomain(orm);
  }
}
