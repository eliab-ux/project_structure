import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  StockProductInfo,
  StockProductLookupPort,
} from '../../../../contexts/stock/application/ports/output/stock-product-lookup.port';
import { ProductOrmEntity } from '../entities/product-orm.entity';
import { ProductComponentOrmEntity } from '../entities/product-component-orm.entity';

/**
 * Adapter do `StockProductLookupPort` — lê o produto (nome, mín/máx, ativo) e, se for kit, a
 * composição, sem o EST depender do módulo de Produto. Os parâmetros vivem no produto (§3.5); o EST
 * os LÊ. Escopado pelo tenant.
 */
@Injectable()
export class StockProductLookup implements StockProductLookupPort {
  constructor(private readonly em: EntityManager) {}

  async findById(productId: string): Promise<StockProductInfo | null> {
    const row = await this.em.findOne(
      ProductOrmEntity,
      { id: productId },
      { fields: ['id', 'name', 'minimumQuantity', 'maximumQuantity', 'active', 'format'] },
    );
    if (!row) {
      return null;
    }
    const isBundle = row.format === 'bundle';
    const components = isBundle
      ? (await this.em.find(ProductComponentOrmEntity, { parentProductId: productId })).map(
          (component) => ({
            productId: component.componentProductId,
            quantity: Number(component.quantity),
          }),
        )
      : [];

    return {
      id: row.id,
      name: row.name,
      minimumQuantity: row.minimumQuantity === null ? null : Number(row.minimumQuantity),
      maximumQuantity: row.maximumQuantity === null ? null : Number(row.maximumQuantity),
      active: row.active,
      isBundle,
      components,
    };
  }
}
