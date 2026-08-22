import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  ProductComponentRepositoryPort,
  ProductComponentRow,
} from '../../../../contexts/product/application/ports/output/product-component-repository.port';
import { ProductComponentOrmEntity } from '../entities/product-component-orm.entity';

/**
 * Repositório da composição de kit. Sem `accountId` nos métodos de leitura — filtro global + RLS
 * escopam. A substituição é por soft-delete + inserção (runtime não tem DELETE), o mesmo padrão das
 * demais coleções.
 */
@Injectable()
export class MikroOrmProductComponentRepository implements ProductComponentRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async findByParent(parentProductId: string): Promise<ProductComponentRow[]> {
    const rows = await this.em.find(ProductComponentOrmEntity, { parentProductId });
    return rows.map((row) => ({
      componentProductId: row.componentProductId,
      quantity: Number(row.quantity),
    }));
  }

  async replaceForParent(
    accountId: string,
    parentProductId: string,
    components: readonly ProductComponentRow[],
  ): Promise<void> {
    const now = new Date();
    const current = await this.em.find(ProductComponentOrmEntity, { parentProductId });
    for (const row of current) {
      row.deletedAt = now;
    }
    for (const component of components) {
      this.em.persist(
        this.em.create(ProductComponentOrmEntity, {
          id: randomUUID(),
          accountId,
          parentProductId,
          componentProductId: component.componentProductId,
          quantity: component.quantity.toFixed(3),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }),
      );
    }
    await this.em.flush();
  }
}
