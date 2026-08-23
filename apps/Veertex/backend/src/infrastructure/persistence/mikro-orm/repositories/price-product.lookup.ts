import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  PriceProductInfo,
  PriceProductLookupPort,
} from '../../../../contexts/price-list/application/ports/output/price-product-lookup.port';
import { ProductOrmEntity } from '../entities/product-orm.entity';

/** Adapter do `PriceProductLookupPort` — lê o produto (nome + preço base). Escopado pelo tenant. */
@Injectable()
export class PriceProductLookup implements PriceProductLookupPort {
  constructor(private readonly em: EntityManager) {}

  async findById(productId: string): Promise<PriceProductInfo | null> {
    const row = await this.em.findOne(
      ProductOrmEntity,
      { id: productId },
      { fields: ['id', 'name', 'basePrice', 'active'] },
    );
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      basePrice: row.basePrice === null ? null : Number(row.basePrice),
      active: row.active,
    };
  }
}
