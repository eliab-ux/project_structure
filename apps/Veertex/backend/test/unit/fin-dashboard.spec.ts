import {
  GetFinanceDashboardQuery,
  GetFinanceDashboardUseCase,
} from '../../src/contexts/finance/application/use-cases/get-finance-dashboard/get-finance-dashboard.use-case';
import {
  DashboardOpenTitleRow,
  DashboardSettlementRow,
  FinanceDashboardPort,
} from '../../src/contexts/finance/application/ports/output/finance-dashboard.port';

const EMPRESA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const AGORA = new Date('2026-08-23T12:00:00Z');
const DIA = 86_400_000;

function fakePort(
  settlements: DashboardSettlementRow[],
  openTitles: DashboardOpenTitleRow[],
): FinanceDashboardPort {
  return {
    settlementsBetween: async () => settlements,
    openTitles: async () => openTitles,
  };
}

/** 05 fatia 5, aceite 5: o card de 7 dias FILTRA e COMPARA por empresa. */
describe('FinanceDashboard — cards de 7 dias, por empresa, com comparativo', () => {
  const settlements: DashboardSettlementRow[] = [
    // Janela ATUAL (últimos 7 dias)
    { companyId: EMPRESA_A, direction: 'receivable', cashAmount: 1000, settledAt: new Date(AGORA.getTime() - 2 * DIA) },
    { companyId: EMPRESA_A, direction: 'payable', cashAmount: 400, settledAt: new Date(AGORA.getTime() - 1 * DIA) },
    { companyId: EMPRESA_B, direction: 'receivable', cashAmount: 300, settledAt: new Date(AGORA.getTime() - 3 * DIA) },
    // Janela ANTERIOR (7–14 dias atrás) — o comparativo
    { companyId: EMPRESA_A, direction: 'receivable', cashAmount: 700, settledAt: new Date(AGORA.getTime() - 10 * DIA) },
  ];
  const openTitles: DashboardOpenTitleRow[] = [
    // vencido (a receber, empresa A)
    { companyId: EMPRESA_A, direction: 'receivable', openAmount: 250, dueDate: new Date(AGORA.getTime() - 5 * DIA) },
    // a vencer nos próximos 7 (a pagar, empresa A)
    { companyId: EMPRESA_A, direction: 'payable', openAmount: 120, dueDate: new Date(AGORA.getTime() + 3 * DIA) },
    // vence longe — não entra em vencidos nem no "próximos 7"
    { companyId: EMPRESA_A, direction: 'receivable', openAmount: 999, dueDate: new Date(AGORA.getTime() + 30 * DIA) },
  ];

  it('agrega por empresa, separa janela atual da anterior e classifica vencido/a vencer', async () => {
    const uc = new GetFinanceDashboardUseCase(fakePort(settlements, openTitles));
    const dto = await uc.execute(new GetFinanceDashboardQuery(null, AGORA));

    const a = dto.companies.find((c) => c.companyId === EMPRESA_A);
    expect(a?.received7d).toBe(1000);
    expect(a?.receivedPrevious7d).toBe(700); // o comparativo
    expect(a?.paid7d).toBe(400);
    expect(a?.overdueReceivable).toBe(250);
    expect(a?.dueNext7dPayable).toBe(120);
    expect(a?.dueNext7dReceivable).toBe(0); // o que vence em 30 dias fica FORA

    expect(dto.totals.received7d).toBe(1300); // A + B
  });

  it('filtro por empresa: só a escolhida entra nos números', async () => {
    const uc = new GetFinanceDashboardUseCase(fakePort(settlements, openTitles));
    const dto = await uc.execute(new GetFinanceDashboardQuery(EMPRESA_B, AGORA));
    expect(dto.companies).toHaveLength(1);
    expect(dto.companies[0].companyId).toBe(EMPRESA_B);
    expect(dto.totals.received7d).toBe(300);
    expect(dto.totals.overdueReceivable).toBe(0);
  });
});
