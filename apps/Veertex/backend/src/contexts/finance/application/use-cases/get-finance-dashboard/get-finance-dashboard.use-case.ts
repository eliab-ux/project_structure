import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  DashboardOpenTitleRow,
  DashboardSettlementRow,
  FINANCE_DASHBOARD,
  FinanceDashboardPort,
} from '../../ports/output/finance-dashboard.port';

export class GetFinanceDashboardQuery {
  constructor(
    /** `null` = todas — empresa é FILTRO E COMPARATIVO em todo card (05 §2.6). */
    public readonly companyId: string | null = null,
    /** Injetável no teste; produção usa o relógio. */
    public readonly now: Date = new Date(),
  ) {}
}

export interface DashboardCompanyCard {
  companyId: string;
  received7d: number;
  paid7d: number;
  /** Janela ANTERIOR (7 dias antes da atual) — o comparativo. */
  receivedPrevious7d: number;
  paidPrevious7d: number;
  overdueReceivable: number;
  overduePayable: number;
  dueNext7dReceivable: number;
  dueNext7dPayable: number;
}

export interface FinanceDashboardDto {
  windowFrom: string;
  windowTo: string;
  companies: DashboardCompanyCard[];
  totals: Omit<DashboardCompanyCard, 'companyId'>;
}

const DAY_MS = 86_400_000;

function emptyCard(): Omit<DashboardCompanyCard, 'companyId'> {
  return {
    received7d: 0,
    paid7d: 0,
    receivedPrevious7d: 0,
    paidPrevious7d: 0,
    overdueReceivable: 0,
    overduePayable: 0,
    dueNext7dReceivable: 0,
    dueNext7dPayable: 0,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Os CARDS do dashboard (05 fatia 5): recebido/pago dos últimos 7 dias, comparativo com os 7
 * anteriores, vencidos e a vencer nos próximos 7 — POR EMPRESA e no total (§2.6: "empresa é filtro
 * E comparativo em todo relatório/card"). Números derivados das baixas e dos títulos em aberto —
 * nunca uma segunda verdade persistida.
 */
@Injectable()
export class GetFinanceDashboardUseCase implements UseCase<
  GetFinanceDashboardQuery,
  FinanceDashboardDto
> {
  constructor(
    @Inject(FINANCE_DASHBOARD) private readonly dashboard: FinanceDashboardPort,
  ) {}

  async execute(query: GetFinanceDashboardQuery): Promise<FinanceDashboardDto> {
    const to = query.now;
    const from = new Date(to.getTime() - 7 * DAY_MS);
    const previousFrom = new Date(from.getTime() - 7 * DAY_MS);

    const [settlements, openTitles] = await Promise.all([
      this.dashboard.settlementsBetween(previousFrom, to),
      this.dashboard.openTitles(),
    ]);

    const byCompany = new Map<string, DashboardCompanyCard>();
    const card = (companyId: string): DashboardCompanyCard => {
      let existing = byCompany.get(companyId);
      if (!existing) {
        existing = { companyId, ...emptyCard() };
        byCompany.set(companyId, existing);
      }
      return existing;
    };

    const wanted = (companyId: string) => !query.companyId || companyId === query.companyId;

    for (const row of settlements.filter((s) => wanted(s.companyId))) {
      const target = card(row.companyId);
      const current = row.settledAt.getTime() >= from.getTime();
      if (row.direction === 'receivable') {
        if (current) target.received7d = round2(target.received7d + row.cashAmount);
        else target.receivedPrevious7d = round2(target.receivedPrevious7d + row.cashAmount);
      } else if (current) {
        target.paid7d = round2(target.paid7d + row.cashAmount);
      } else {
        target.paidPrevious7d = round2(target.paidPrevious7d + row.cashAmount);
      }
    }

    const next7 = new Date(to.getTime() + 7 * DAY_MS);
    for (const row of openTitles.filter((t) => wanted(t.companyId))) {
      const target = card(row.companyId);
      const overdue = row.dueDate.getTime() < to.getTime();
      const dueSoon = !overdue && row.dueDate.getTime() <= next7.getTime();
      if (row.direction === 'receivable') {
        if (overdue) target.overdueReceivable = round2(target.overdueReceivable + row.openAmount);
        if (dueSoon) {
          target.dueNext7dReceivable = round2(target.dueNext7dReceivable + row.openAmount);
        }
      } else {
        if (overdue) target.overduePayable = round2(target.overduePayable + row.openAmount);
        if (dueSoon) target.dueNext7dPayable = round2(target.dueNext7dPayable + row.openAmount);
      }
    }

    const totals = emptyCard();
    for (const company of byCompany.values()) {
      totals.received7d = round2(totals.received7d + company.received7d);
      totals.paid7d = round2(totals.paid7d + company.paid7d);
      totals.receivedPrevious7d = round2(totals.receivedPrevious7d + company.receivedPrevious7d);
      totals.paidPrevious7d = round2(totals.paidPrevious7d + company.paidPrevious7d);
      totals.overdueReceivable = round2(totals.overdueReceivable + company.overdueReceivable);
      totals.overduePayable = round2(totals.overduePayable + company.overduePayable);
      totals.dueNext7dReceivable = round2(
        totals.dueNext7dReceivable + company.dueNext7dReceivable,
      );
      totals.dueNext7dPayable = round2(totals.dueNext7dPayable + company.dueNext7dPayable);
    }

    return {
      windowFrom: from.toISOString(),
      windowTo: to.toISOString(),
      companies: [...byCompany.values()],
      totals,
    };
  }
}

export type { DashboardSettlementRow, DashboardOpenTitleRow };
