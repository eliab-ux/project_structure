import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ContactOverdueLookupPort } from '../../../../contexts/order/application/ports/output/contact-overdue-lookup.port';
import { FinancialTitleOrmEntity } from '../entities/financial-title-orm.entity';

const DAY_MS = 86_400_000;

/** Adapter do bloqueio por inadimplência — lê os títulos; tenant via filtro global + RLS. */
@Injectable()
export class MikroOrmContactOverdueLookup implements ContactOverdueLookupPort {
  constructor(private readonly em: EntityManager) {}

  async overdueAmount(contactId: string, olderThanDays: number, now: Date): Promise<number> {
    const threshold = new Date(now.getTime() - olderThanDays * DAY_MS);
    const rows = await this.em.find(
      FinancialTitleOrmEntity,
      {
        contactId,
        direction: 'receivable',
        status: { $in: ['open', 'partial'] },
        dueDate: { $lt: threshold },
      },
      { populate: ['settlements'] },
    );
    return rows.reduce((sum, row) => {
      const settled = row.settlements
        .getItems()
        .reduce((acc, settlement) => acc + Number(settlement.principal), 0);
      return sum + Math.max(0, Number(row.amount) - settled);
    }, 0);
  }
}
