import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  WalletTitleInfo,
  WalletTitleLookupPort,
} from '../../../../contexts/route/application/ports/output/wallet-title-lookup.port';
import { ContactOrmEntity } from '../entities/contact-orm.entity';
import { FinancialTitleOrmEntity } from '../entities/financial-title-orm.entity';

/**
 * Adapter do `WalletTitleLookupPort` (§3.4 do 04): títulos a receber de CONSIGNAÇÃO em aberto
 * (open/partial) cujos contatos são carteirizados na rota. Duas consultas escopadas (contatos da
 * rota → títulos dos contatos); o filtro global + RLS escopam por conta.
 */
@Injectable()
export class WalletTitleLookup implements WalletTitleLookupPort {
  constructor(private readonly em: EntityManager) {}

  async findOpenConsignmentTitlesByRoute(routeId: string): Promise<WalletTitleInfo[]> {
    const contacts = await this.em.find(
      ContactOrmEntity,
      { routeId, active: true },
      { fields: ['id'] },
    );
    if (contacts.length === 0) {
      return [];
    }

    const titles = await this.em.find(
      FinancialTitleOrmEntity,
      {
        direction: 'receivable',
        origin: 'consignment',
        status: { $in: ['open', 'partial'] },
        contactId: { $in: contacts.map((c) => c.id) },
      },
      { populate: ['settlements'] },
    );

    return titles.map((title) => {
      const settled = title.settlements.getItems().reduce((sum, s) => sum + Number(s.principal), 0);
      return {
        titleId: title.id,
        contactId: title.contactId as string,
        openAmount: Math.round((Number(title.amount) - settled + Number.EPSILON) * 100) / 100,
        status: title.status,
      };
    });
  }
}
