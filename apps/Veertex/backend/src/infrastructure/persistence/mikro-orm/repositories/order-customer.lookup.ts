import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  CustomerInfo,
  CustomerLookupPort,
} from '../../../../contexts/order/application/ports/output/customer-lookup.port';
import { ContactOrmEntity } from '../entities/contact-orm.entity';

/**
 * Adapter do `CustomerLookupPort` — lê a tabela de contatos e responde só o que o VND pediu, sem que
 * o VND dependa do módulo de Contato. Escopado pelo tenant (filtro global + RLS).
 */
@Injectable()
export class OrderCustomerLookup implements CustomerLookupPort {
  constructor(private readonly em: EntityManager) {}

  async findById(contactId: string): Promise<CustomerInfo | null> {
    const row = await this.em.findOne(
      ContactOrmEntity,
      { id: contactId },
      { fields: ['id', 'legalName', 'tradeName', 'types', 'creditLimit', 'salesRepId', 'active'] },
    );
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      displayName: row.tradeName ?? row.legalName,
      creditLimit: row.creditLimit === null ? null : Number(row.creditLimit),
      salesRepId: row.salesRepId,
      isCustomer: (row.types ?? []).includes('customer'),
      active: row.active,
    };
  }
}
