import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  OrderProductInfo,
  OrderProductLookupPort,
} from '../../../../contexts/order/application/ports/output/order-product-lookup.port';
import { ProductOrmEntity } from '../entities/product-orm.entity';

/**
 * Adapter do `OrderProductLookupPort` — lê a tabela de produtos e responde só o que o VND pediu.
 * Escopado pelo tenant; id de outra conta não vem.
 */
@Injectable()
export class OrderProductLookup implements OrderProductLookupPort {
  constructor(private readonly em: EntityManager) {}

  async findByIds(productIds: readonly string[]): Promise<Map<string, OrderProductInfo>> {
    if (productIds.length === 0) {
      return new Map();
    }
    const rows = await this.em.find(
      ProductOrmEntity,
      { id: { $in: [...new Set(productIds)] } },
      { fields: ['id', 'name', 'basePrice', 'active'] },
    );
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          basePrice: row.basePrice === null ? null : Number(row.basePrice),
          active: row.active,
        },
      ]),
    );
  }
}
