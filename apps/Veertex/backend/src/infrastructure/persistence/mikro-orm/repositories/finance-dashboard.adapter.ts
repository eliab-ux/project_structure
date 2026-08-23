import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  DashboardOpenTitleRow,
  DashboardSettlementRow,
  FinanceDashboardPort,
} from '../../../../contexts/finance/application/ports/output/finance-dashboard.port';
import { TitleSettlementOrmEntity } from '../entities/title-settlement-orm.entity';
import { FinancialTitleOrmEntity } from '../entities/financial-title-orm.entity';

/**
 * Adapter de LEITURA do dashboard — devolve linhas; a agregação vive no use case (testável sem
 * banco). Escopado por tenant (filtro global + RLS), como toda leitura.
 */
@Injectable()
export class MikroOrmFinanceDashboard implements FinanceDashboardPort {
  constructor(private readonly em: EntityManager) {}

  async settlementsBetween(from: Date, to: Date): Promise<DashboardSettlementRow[]> {
    const rows = await this.em.find(
      TitleSettlementOrmEntity,
      { settledAt: { $gte: from, $lte: to } },
      { populate: ['title'] },
    );
    return rows.map((row) => ({
      companyId: row.title.companyId,
      direction: row.title.direction as 'receivable' | 'payable',
      cashAmount:
        Number(row.principal) + Number(row.interest) + Number(row.fine) - Number(row.discount),
      settledAt: row.settledAt,
    }));
  }

  async openTitles(): Promise<DashboardOpenTitleRow[]> {
    // O aberto é DERIVADO (valor − baixas de principal) — mesma régua do domínio, nunca coluna.
    const rows = await this.em.find(
      FinancialTitleOrmEntity,
      { status: { $in: ['open', 'partial'] } },
      { populate: ['settlements'] },
    );
    return rows.map((row) => {
      const settledPrincipal = row.settlements
        .getItems()
        .reduce((sum, settlement) => sum + Number(settlement.principal), 0);
      return {
        companyId: row.companyId,
        direction: row.direction as 'receivable' | 'payable',
        openAmount: Math.round((Number(row.amount) - settledPrincipal) * 100) / 100,
        dueDate: row.dueDate,
      };
    });
  }
}
