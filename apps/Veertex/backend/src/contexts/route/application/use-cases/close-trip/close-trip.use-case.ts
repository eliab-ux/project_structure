import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  CreateFinancialTitleCommand,
  CreateFinancialTitleUseCase,
} from '../../../../finance/application/use-cases/create-financial-title/create-financial-title.use-case';
import {
  COMMISSION_B_TIER_REPOSITORY,
  CommissionBTierRepositoryPort,
  DEFAULT_MODEL_B_TIERS,
} from '../../../../commission/application/ports/output/commission-b-tier-repository.port';
import { computeModelBCommission } from '../../../../commission/domain/model-b';
import { commissionDueDate } from '../../../../commission/domain/commission-due';
import { AccountPreferencesReader } from '../../../../account/application/account-preferences.reader';
import { round2 } from '../../../../commission/domain/model-a';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../../ports/output/trip-repository.port';
import {
  TRIP_COLLECTION_REPOSITORY,
  TripCollectionRepositoryPort,
} from '../../ports/output/trip-collection-repository.port';
import {
  FIELD_RECEIPT_REPOSITORY,
  FieldReceiptRepositoryPort,
} from '../../ports/output/field-receipt-repository.port';
import {
  TRIP_EXPENSE_REPOSITORY,
  TripExpenseRepositoryPort,
} from '../../ports/output/trip-expense-repository.port';
import { TripNotFoundException } from '../../../domain/exceptions/route-exceptions';

export class CloseTripCommand {
  constructor(
    public readonly accountId: string,
    public readonly tripId: string,
    /** Folha além do representante — informada no fechamento (cadastro fino vem depois). */
    public readonly payroll: {
      managerUserId?: string | null;
      /** Y% do gerente sobre o recebido da carteira (§3.6 do 04). */
      managerPercent?: number | null;
      /** Ajudante: valor FIXO da(s) semana(s) da viagem — não é % (§2 do 04). */
      helperAmount?: number | null;
    } = {},
  ) {}
}

export interface TripClosureSummary {
  /** Blocos cobrança/recobrança (§3.5): consignado (carteira) × recebido × %. */
  cobranca: { wallet: number; received: number; percent: number };
  recobranca: { wallet: number; received: number; percent: number };
  interestReceived: number;
  /** Outros recebimentos (venda à vista) — fora da carteira. */
  otherReceipts: number;
  /** Despesas por categoria + total + % sobre o recebido. */
  expenses: { byCategory: Record<string, number>; total: number; percentOfReceived: number };
  /** Conferência física × sistema: caixa esperado × contado → diferença. */
  cash: { expected: number; counted: number | null; difference: number | null };
  /** Folha de comissões (§3.6): motor B do representante + gerente + ajudante. */
  commission: {
    wallet: number;
    received: number;
    ratioPercent: number;
    appliedThresholdPercent: number | null;
    commissionPercent: number;
    repCommission: number;
    managerCommission: number;
    helperAmount: number;
    payableTitleIds: string[];
  };
  /**
   * Comparativo com a viagem ANTERIOR fechada da mesma rota (§3.5). `null` = primeira viagem da
   * rota. Os números da anterior são RECOMPUTADOS das cobranças/recebimentos dela (append-only) —
   * mesma régua do fechamento atual, nunca uma segunda verdade persistida.
   */
  previousTrip: {
    tripId: string;
    departureAt: string | null;
    wallet: number;
    received: number;
    receivedPercent: number;
    expensesTotal: number;
    /** Deltas = atual − anterior (recebido, % de recebimento, despesas). */
    deltas: { received: number; receivedPercent: number; expensesTotal: number };
  } | null;
}

/**
 * FECHAMENTO da viagem (§3.5/§3.6 do 04) — o batimento que espelha as planilhas reais, e o GATILHO
 * da comissão do Modelo B. Blocos: cobrança/recobrança (carteira × recebido × %), outros
 * recebimentos (fora da carteira), despesas por categoria, conferência física×sistema (caixa), e a
 * folha de comissões → **contas a pagar no FIN** (a empresa do título VEM DA VIAGEM — decisão
 * ratificada, sem parâmetro; diferente do Modelo A, onde o operador escolhe).
 *
 * Comissão B: `recebido ÷ carteira` → faixa (da conta; default = faixas reais da operação) → % DIRETO
 * sobre o recebido — que JÁ É líquido da comissão do revendedor (ela paga líquido; o desconto
 * aconteceu no acerto). Só recebimentos EFETIVADOS e DE CARTEIRA contam (§3.2: à vista fica fora).
 */
@Injectable()
export class CloseTripUseCase implements UseCase<CloseTripCommand, TripClosureSummary> {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(TRIP_COLLECTION_REPOSITORY)
    private readonly collections: TripCollectionRepositoryPort,
    @Inject(FIELD_RECEIPT_REPOSITORY) private readonly receipts: FieldReceiptRepositoryPort,
    @Inject(TRIP_EXPENSE_REPOSITORY) private readonly expenses: TripExpenseRepositoryPort,
    @Inject(COMMISSION_B_TIER_REPOSITORY)
    private readonly bTiers: CommissionBTierRepositoryPort,
    private readonly createTitle: CreateFinancialTitleUseCase,
    private readonly preferences: AccountPreferencesReader,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CloseTripCommand): Promise<TripClosureSummary> {
    return this.uow.execute(async () => {
      const trip = await this.trips.findById(command.tripId);
      if (!trip) {
        throw new TripNotFoundException();
      }

      const collections = await this.collections.listByTrip(trip.id);
      const receipts = (await this.receipts.listByTrip(trip.id)).filter(
        (r) => r.status === 'efetivado',
      );
      const expenses = await this.expenses.listByTrip(trip.id);

      // ── Blocos cobrança/recobrança (§3.5) ─────────────────────────────────────────────────────
      const walletByKind = { cobranca: 0, recobranca: 0 };
      const titleKind = new Map<string, 'cobranca' | 'recobranca'>();
      for (const c of collections) {
        walletByKind[c.kind] += c.amountAtBuild;
        titleKind.set(c.titleId, c.kind);
      }
      const receivedByKind = { cobranca: 0, recobranca: 0 };
      let interestReceived = 0;
      let otherReceipts = 0;
      for (const r of receipts) {
        if (r.insideWallet && r.titleId) {
          const kind = titleKind.get(r.titleId) ?? 'cobranca';
          receivedByKind[kind] += r.amount;
          interestReceived += r.interest;
        } else {
          otherReceipts += r.amount;
        }
      }

      // ── Despesas por categoria (§3.5) ─────────────────────────────────────────────────────────
      const byCategory: Record<string, number> = {};
      let expensesTotal = 0;
      for (const e of expenses) {
        byCategory[e.category] = round2((byCategory[e.category] ?? 0) + e.amount);
        expensesTotal += e.amount;
      }

      const wallet = round2(walletByKind.cobranca + walletByKind.recobranca);
      const received = round2(receivedByKind.cobranca + receivedByKind.recobranca);
      const totalCashIn = round2(received + interestReceived + otherReceipts);

      // ── Conferência física × sistema (§3.5): caixa esperado × contado ─────────────────────────
      // Esperado = caixa inicial + tudo que entrou em DINHEIRO − despesas (pagas do caixa da viagem).
      const cashReceipts = receipts
        .filter((r) => r.method === 'dinheiro')
        .reduce((sum, r) => sum + r.amount + r.interest, 0);
      const expectedCash = round2(trip.initialCash + cashReceipts - expensesTotal);
      const countedCash = trip.returnCash;
      const cashDifference = countedCash === null ? null : round2(countedCash - expectedCash);

      // ── Folha de comissões (§3.6) — motor B, faixas da conta (default = operação real) ────────
      const accountTiers = await this.bTiers.getForAccount();
      const tiers = accountTiers.length > 0 ? accountTiers : [...DEFAULT_MODEL_B_TIERS];
      const modelB = computeModelBCommission({
        recebido: received,
        carteira: wallet,
        base: received, // a revendedora paga LÍQUIDO da comissão dela — o recebido já é a base
        tiers,
      });

      const managerPercent = Math.max(0, command.payroll.managerPercent ?? 0);
      const managerCommission = round2((received * managerPercent) / 100);
      const helperAmount = round2(Math.max(0, command.payroll.helperAmount ?? 0));

      // ── Contas a pagar no FIN (a EMPRESA vem da viagem) ───────────────────────────────────────
      // Vencimento pela regra da conta (commission_due_rule) sobre o MÊS DO FECHAMENTO — a mesma
      // função do Modelo A; duas cópias divergiriam no primeiro ajuste.
      const payableTitleIds: string[] = [];
      const dueDate = commissionDueDate(
        new Date(),
        await this.preferences.forAccount(command.accountId),
      );
      const emit = async (description: string, amount: number) => {
        if (amount <= 0) return;
        const title = await this.createTitle.execute(
          new CreateFinancialTitleCommand(command.accountId, 'payable', {
            companyId: trip.companyId,
            description,
            amount,
            dueDate,
          }),
        );
        payableTitleIds.push(title.id);
      };
      await emit(
        `Comissão do representante — viagem ${trip.id.slice(0, 8)}`,
        modelB.commissionValue,
      );
      await emit(`Comissão do gerente — viagem ${trip.id.slice(0, 8)}`, managerCommission);
      await emit(`Ajudante — viagem ${trip.id.slice(0, 8)}`, helperAmount);

      // ── Efetiva o fechamento (em_fechamento → fechada) e PERSISTE os inputs da folha ──────────
      trip.registerClosure({
        managerUserId: command.payroll.managerUserId ?? null,
        managerPercent: managerPercent > 0 ? managerPercent : null,
        helperAmount: helperAmount > 0 ? helperAmount : null,
        commissionPercent: modelB.commissionPercent,
        repCommission: modelB.commissionValue,
      });
      trip.close();
      await this.trips.save(trip);

      const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

      // ── Comparativo com a viagem anterior (§3.5) ──────────────────────────────────────────────
      const receivedPercent = pct(received, wallet);
      const previousTrip = await this.buildPreviousTripComparison(trip, {
        received,
        receivedPercent,
        expensesTotal: round2(expensesTotal),
      });

      return {
        cobranca: {
          wallet: round2(walletByKind.cobranca),
          received: round2(receivedByKind.cobranca),
          percent: pct(receivedByKind.cobranca, walletByKind.cobranca),
        },
        recobranca: {
          wallet: round2(walletByKind.recobranca),
          received: round2(receivedByKind.recobranca),
          percent: pct(receivedByKind.recobranca, walletByKind.recobranca),
        },
        interestReceived: round2(interestReceived),
        otherReceipts: round2(otherReceipts),
        expenses: {
          byCategory,
          total: round2(expensesTotal),
          percentOfReceived: pct(expensesTotal, totalCashIn),
        },
        cash: { expected: expectedCash, counted: countedCash, difference: cashDifference },
        commission: {
          wallet,
          received,
          ratioPercent: modelB.ratioPercent,
          appliedThresholdPercent: modelB.appliedThresholdPercent,
          commissionPercent: modelB.commissionPercent,
          repCommission: modelB.commissionValue,
          managerCommission,
          helperAmount,
          payableTitleIds,
        },
        previousTrip,
      };
    });
  }

  /**
   * A viagem anterior = a última FECHADA da mesma rota que saiu antes desta. Os números dela saem
   * das cobranças/recebimentos append-only (mesma régua do fechamento atual). Falha aqui não pode
   * derrubar um fechamento — o comparativo é leitura; sem anterior, é `null` e o fechamento segue.
   */
  private async buildPreviousTripComparison(
    trip: { id: string; routeId: string; departureAt: Date | null; createdAt: Date },
    current: { received: number; receivedPercent: number; expensesTotal: number },
  ): Promise<TripClosureSummary['previousTrip']> {
    const closed = await this.trips.list({ routeId: trip.routeId, status: 'fechada' });
    const anchor = (trip.departureAt ?? trip.createdAt).getTime();
    const previous = closed
      .filter((t) => t.id !== trip.id)
      .filter((t) => (t.departureAt ?? t.createdAt).getTime() <= anchor)
      .sort(
        (a, b) => (b.departureAt ?? b.createdAt).getTime() - (a.departureAt ?? a.createdAt).getTime(),
      )[0];
    if (!previous) {
      return null;
    }

    const collections = await this.collections.listByTrip(previous.id);
    const walletTitleIds = new Set(collections.map((c) => c.titleId));
    const wallet = round2(collections.reduce((sum, c) => sum + c.amountAtBuild, 0));

    const receipts = (await this.receipts.listByTrip(previous.id)).filter(
      (r) => r.status === 'efetivado',
    );
    const received = round2(
      receipts
        .filter((r) => r.insideWallet && r.titleId && walletTitleIds.has(r.titleId))
        .reduce((sum, r) => sum + r.amount, 0),
    );

    const expensesTotal = round2(
      (await this.expenses.listByTrip(previous.id)).reduce((sum, e) => sum + e.amount, 0),
    );

    const receivedPercent = wallet > 0 ? round2((received / wallet) * 100) : 0;
    return {
      tripId: previous.id,
      departureAt: previous.departureAt ? previous.departureAt.toISOString() : null,
      wallet,
      received,
      receivedPercent,
      expensesTotal,
      deltas: {
        received: round2(current.received - received),
        receivedPercent: round2(current.receivedPercent - receivedPercent),
        expensesTotal: round2(current.expensesTotal - expensesTotal),
      },
    };
  }
}
