import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  StockProductInfo,
  StockProductLookupPort,
} from '../../../../contexts/stock/application/ports/output/stock-product-lookup.port';
import { ProductOrmEntity } from '../entities/product-orm.entity';

/**
 * Adapter do `StockProductLookupPort` — lê o produto (nome, mín/máx, ativo) sem o EST depender do
 * módulo de Produto. Os parâmetros de mínimo/máximo vivem no produto (§3.5 do CORE); o EST os LÊ, não
 * os duplica. Escopado pelo tenant.
 */
@Injectable()
export class StockProductLookup implements StockProductLookupPort {
  constructor(private readonly em: EntityManager) {}

  async findById(productId: string): Promise<StockProductInfo | null> {
    const row = await this.em.findOne(
      ProductOrmEntity,
      { id: productId },
      { fields: ['id', 'name', 'minimumQuantity', 'maximumQuantity', 'active'] },
    );
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      minimumQuantity: row.minimumQuantity === null ? null : Number(row.minimumQuantity),
      maximumQuantity: row.maximumQuantity === null ? null : Number(row.maximumQuantity),
      active: row.active,
    };
  }
}
