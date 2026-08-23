import {
  CloseTripCommand,
  CloseTripUseCase,
} from '../../src/contexts/route/application/use-cases/close-trip/close-trip.use-case';
import { Trip } from '../../src/contexts/route/domain/entities/trip.entity';
import { TripCollection } from '../../src/contexts/route/domain/entities/trip-collection.entity';
import { FieldReceipt } from '../../src/contexts/route/domain/entities/field-receipt.entity';
import { TripExpense } from '../../src/contexts/route/domain/entities/trip-expense.entity';
import { TripRepositoryPort } from '../../src/contexts/route/application/ports/output/trip-repository.port';
import { TripCollectionRepositoryPort } from '../../src/contexts/route/application/ports/output/trip-collection-repository.port';
import { FieldReceiptRepositoryPort } from '../../src/contexts/route/application/ports/output/field-receipt-repository.port';
import { TripExpenseRepositoryPort } from '../../src/contexts/route/application/ports/output/trip-expense-repository.port';
import { CommissionBTierRepositoryPort } from '../../src/contexts/commission/application/ports/output/commission-b-tier-repository.port';
import {
  CreateFinancialTitleCommand,
  CreateFinancialTitleUseCase,
} from '../../src/contexts/finance/application/use-cases/create-financial-title/create-financial-title.use-case';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const ROTA = '33333333-3333-4333-8333-333333333333';
const VENDEDOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

/** Preferências da conta com a regra de vencimento DEFAULT (último dia do período). */
const prefsFalso = {
  forAccount: async () => ({
    commissionDueRule: 'last_day_of_period',
    commissionDueDay: 5,
  }),
} as never;

function viagemEmFechamento(initialCash = 0): Trip {
  const trip = Trip.create({
    accountId: CONTA,
    companyId: EMPRESA,
    routeId: ROTA,
    salesRepId: VENDEDOR,
    initialCash,
  });
  trip.depart();
  trip.arrive({});
  return trip;
}

function cobranca(trip: Trip, titleId: string, amount: number): TripCollection {
  return TripCollection.create({
    accountId: CONTA,
    tripId: trip.id,
    titleId,
    kind: 'cobranca',
    amountAtBuild: amount,
  });
}

function recebimentoEfetivado(
  trip: Trip,
  titleId: string | null,
  amount: number,
  method: 'dinheiro' | 'pix' = 'pix',
  interest = 0,
): FieldReceipt {
  const receipt = FieldReceipt.create({
    accountId: CONTA,
    tripId: trip.id,
    titleId,
    method,
    amount,
    interest,
  });
  receipt.effectuate();
  return receipt;
}

function fakes(params: {
  trip: Trip;
  collections: TripCollection[];
  receipts: FieldReceipt[];
  expenses?: TripExpense[];
}) {
  const trips: TripRepositoryPort = {
    findById: async () => params.trip,
    list: async () => [params.trip],
    save: async (t) => t,
  };
  const collections: TripCollectionRepositoryPort = {
    listByTrip: async () => params.collections,
    countByTitle: async () => 0,
    existsForTripTitle: async () => false,
    save: async (c) => c,
  };
  const receipts: FieldReceiptRepositoryPort = {
    findById: async () => null,
    listByTrip: async () => params.receipts,
    save: async (r) => r,
  };
  const expenses: TripExpenseRepositoryPort = {
    listByTrip: async () => params.expenses ?? [],
    save: async (e) => e,
  };
  // Sem faixas cadastradas → o use case usa as DEFAULT (reais da operação).
  const bTiers: CommissionBTierRepositoryPort = {
    getForAccount: async () => [],
    replaceForAccount: async (_a, t) => t,
  };
  const created: { description: string; amount: number; companyId: string }[] = [];
  const createTitle = {
    execute: async (cmd: CreateFinancialTitleCommand) => {
      created.push({
        description: cmd.input.description,
        amount: cmd.input.amount,
        companyId: cmd.input.companyId,
      });
      return { id: `title-${created.length}`, status: 'open' };
    },
  } as unknown as CreateFinancialTitleUseCase;

  const uc = new CloseTripUseCase(
    trips,
    collections,
    receipts,
    expenses,
    bTiers,
    createTitle,
    prefsFalso,
    uowFalso,
  );
  return { uc, created };
}

describe('CloseTrip — fechamento com a MASSA REAL do Modelo B ao centavo (§3.5/§3.6 do 04)', () => {
  it('aba 03-07: recebido 46.161,40 / carteira 47.726,84 → 96,72% → 8% → R$ 3.692,91', async () => {
    const trip = viagemEmFechamento();
    const { uc, created } = fakes({
      trip,
      collections: [cobranca(trip, 't1', 47726.84)],
      receipts: [recebimentoEfetivado(trip, 't1', 46161.4)],
    });
    const summary = await uc.execute(new CloseTripCommand(CONTA, trip.id));

    expect(summary.commission.ratioPercent).toBe(96.72);
    expect(summary.commission.appliedThresholdPercent).toBe(90);
    expect(summary.commission.commissionPercent).toBe(8);
    expect(summary.commission.repCommission).toBe(3692.91); // NO CENTAVO
    // Conta a pagar materializada NA EMPRESA DA VIAGEM (decisão ratificada: sem parâmetro).
    expect(created).toHaveLength(1);
    expect(created[0].amount).toBe(3692.91);
    expect(created[0].companyId).toBe(EMPRESA);
    expect(trip.status).toBe('fechada');
  });

  it('aba 04-05: faixa 70–89,99% → 7% sobre R$ 52.663,90 = R$ 3.686,47', async () => {
    const trip = viagemEmFechamento();
    // carteira 62.000 → razão 84,94% (faixa 70). Base = recebido (líquido do revendedor).
    const { uc, created } = fakes({
      trip,
      collections: [cobranca(trip, 't1', 62000)],
      receipts: [recebimentoEfetivado(trip, 't1', 52663.9)],
    });
    const summary = await uc.execute(new CloseTripCommand(CONTA, trip.id));

    expect(summary.commission.appliedThresholdPercent).toBe(70);
    expect(summary.commission.commissionPercent).toBe(7);
    expect(summary.commission.repCommission).toBe(3686.47); // NO CENTAVO
    expect(created[0].amount).toBe(3686.47);
  });

  it('batimento: à vista fica FORA da carteira; despesas por categoria; caixa esperado×contado', async () => {
    const trip = viagemEmFechamento(500);
    trip.editHeader({ returnCash: 1540 });
    const { uc } = fakes({
      trip,
      collections: [cobranca(trip, 't1', 2000)],
      receipts: [
        recebimentoEfetivado(trip, 't1', 1000, 'dinheiro', 50), // carteira, em dinheiro, com juros
        recebimentoEfetivado(trip, null, 300, 'pix'), // à vista — outros recebimentos
      ],
      expenses: [
        TripExpense.create({
          accountId: CONTA,
          tripId: trip.id,
          category: 'combustivel',
          amount: 80,
        }),
        TripExpense.create({
          accountId: CONTA,
          tripId: trip.id,
          category: 'combustivel',
          amount: 20,
        }),
        TripExpense.create({ accountId: CONTA, tripId: trip.id, category: 'hotel', amount: 150 }),
      ],
    });
    const summary = await uc.execute(new CloseTripCommand(CONTA, trip.id));

    expect(summary.cobranca.wallet).toBe(2000);
    expect(summary.cobranca.received).toBe(1000);
    expect(summary.cobranca.percent).toBe(50);
    expect(summary.interestReceived).toBe(50);
    expect(summary.otherReceipts).toBe(300); // fora da carteira — não entra na razão B
    expect(summary.commission.ratioPercent).toBe(50); // 1000/2000, sem os 300 à vista
    expect(summary.expenses.byCategory.combustivel).toBe(100);
    expect(summary.expenses.byCategory.hotel).toBe(150);
    expect(summary.expenses.total).toBe(250);
    // Caixa esperado = 500 inicial + (1000+50 em dinheiro) − 250 despesas = 1300; contado 1540 → +240.
    expect(summary.cash.expected).toBe(1300);
    expect(summary.cash.counted).toBe(1540);
    expect(summary.cash.difference).toBe(240);
  });

  it('folha além do representante: gerente Y% sobre o recebido + ajudante fixo → contas a pagar', async () => {
    const trip = viagemEmFechamento();
    const { uc, created } = fakes({
      trip,
      collections: [cobranca(trip, 't1', 10000)],
      receipts: [recebimentoEfetivado(trip, 't1', 10000)], // 100% → 8%
    });
    const summary = await uc.execute(
      new CloseTripCommand(CONTA, trip.id, { managerPercent: 2, helperAmount: 600 }),
    );
    expect(summary.commission.repCommission).toBe(800);
    expect(summary.commission.managerCommission).toBe(200);
    expect(summary.commission.helperAmount).toBe(600);
    expect(created).toHaveLength(3);
    expect(created.map((c) => c.amount)).toEqual([800, 200, 600]);
  });
});

describe('CloseTrip — comparativo com a viagem anterior (§3.5 do 04)', () => {
  function fecharViagemAnterior(): Trip {
    const prev = Trip.create({
      accountId: CONTA,
      companyId: EMPRESA,
      routeId: ROTA,
      salesRepId: VENDEDOR,
    });
    prev.depart();
    prev.arrive({});
    prev.registerClosure({
      managerUserId: null,
      managerPercent: null,
      helperAmount: null,
      commissionPercent: 5,
      repCommission: 50,
    });
    prev.close();
    return prev;
  }

  function fakesComAnterior(atual: Trip, anterior: Trip) {
    const porViagem = <T>(mapa: Record<string, T[]>) => ({
      listByTrip: async (tripId: string) => mapa[tripId] ?? [],
    });
    const trips: TripRepositoryPort = {
      findById: async () => atual,
      list: async (filter) =>
        [atual, anterior].filter((t) => !filter.status || t.status === filter.status),
      save: async (t) => t,
    };
    const collections: TripCollectionRepositoryPort = {
      ...porViagem({
        [atual.id]: [cobranca(atual, 'atual-t1', 10000)],
        [anterior.id]: [cobranca(anterior, 'prev-t1', 2000)],
      }),
      countByTitle: async () => 0,
      existsForTripTitle: async () => false,
      save: async (c) => c,
    };
    const receipts: FieldReceiptRepositoryPort = {
      findById: async () => null,
      ...porViagem({
        [atual.id]: [recebimentoEfetivado(atual, 'atual-t1', 10000)],
        [anterior.id]: [recebimentoEfetivado(anterior, 'prev-t1', 1000)],
      }),
      save: async (r) => r,
    };
    const expenses: TripExpenseRepositoryPort = {
      ...porViagem({
        [atual.id]: [],
        [anterior.id]: [
          TripExpense.create({ accountId: CONTA, tripId: anterior.id, category: 'hotel', amount: 250 }),
        ],
      }),
      save: async (e) => e,
    };
    const bTiers: CommissionBTierRepositoryPort = {
      getForAccount: async () => [],
      replaceForAccount: async (_a, t) => t,
    };
    const createTitle = {
      execute: async () => ({ id: 'title-x', status: 'open' }),
    } as unknown as CreateFinancialTitleUseCase;
    return new CloseTripUseCase(
      trips,
      collections,
      receipts,
      expenses,
      bTiers,
      createTitle,
      prefsFalso,
      uowFalso,
    );
  }

  it('recomputa a anterior das próprias cobranças/recebimentos e entrega os deltas', async () => {
    const anterior = fecharViagemAnterior();
    const atual = viagemEmFechamento();
    const uc = fakesComAnterior(atual, anterior);

    const summary = await uc.execute(new CloseTripCommand(CONTA, atual.id));

    expect(summary.previousTrip).not.toBeNull();
    expect(summary.previousTrip?.tripId).toBe(anterior.id);
    expect(summary.previousTrip?.wallet).toBe(2000);
    expect(summary.previousTrip?.received).toBe(1000);
    expect(summary.previousTrip?.receivedPercent).toBe(50);
    expect(summary.previousTrip?.expensesTotal).toBe(250);
    // Atual: 10000/10000 = 100%, sem despesas → deltas contra a anterior.
    expect(summary.previousTrip?.deltas.received).toBe(9000);
    expect(summary.previousTrip?.deltas.receivedPercent).toBe(50);
    expect(summary.previousTrip?.deltas.expensesTotal).toBe(-250);
  });

  it('primeira viagem da rota → previousTrip = null (o fechamento segue normal)', async () => {
    const trip = viagemEmFechamento();
    const { uc } = fakes({
      trip,
      collections: [cobranca(trip, 't1', 1000)],
      receipts: [recebimentoEfetivado(trip, 't1', 1000)],
    });
    const summary = await uc.execute(new CloseTripCommand(CONTA, trip.id));
    expect(summary.previousTrip).toBeNull();
  });
});
