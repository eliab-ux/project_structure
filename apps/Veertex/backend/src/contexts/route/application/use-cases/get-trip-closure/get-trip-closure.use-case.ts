import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
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
import {
  TripMismatchException,
  TripNotFoundException,
} from '../../../domain/exceptions/route-exceptions';
import { buildPreviousTripComparison, computeClosureBlocks } from '../../trip-closure-math';
import { TripClosureSummary } from '../close-trip/close-trip.use-case';

export class GetTripClosureQuery {
  constructor(public readonly tripId: string) {}
}

/**
 * RE-EXIBE o batimento de uma viagem FECHADA (ratificação de 23/08/2026: "auditoria que não se relê
 * não é auditoria"). **Recomputação determinística, não snapshot** — decisão registrada:
 *
 *  - os blocos (cobrança/recobrança, despesas, caixa) saem da MESMA `computeClosureBlocks` do
 *    fechamento, sobre dados append-only (cobranças, recebimentos efetivados, despesas) — não há
 *    como divergirem do que o fechamento viu;
 *  - a FOLHA sai dos inputs persistidos em `closure_*` (gerente %, ajudante, % aplicada, comissão
 *    do representante) — persistidos exatamente para o batimento ser reproduzível (nota 5);
 *  - `appliedThresholdPercent` NÃO é recomputado das faixas atuais: as faixas da conta podem ter
 *    mudado depois do fechamento, e recomputar mentiria sobre o que foi pago. Vem `null`, e o % e
 *    o valor pagos vêm do persistido;
 *  - `payableTitleIds` não persiste no fechamento — volta vazio (os títulos vivem no FIN).
 */
@Injectable()
export class GetTripClosureUseCase implements UseCase<GetTripClosureQuery, TripClosureSummary> {
  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: TripRepositoryPort,
    @Inject(TRIP_COLLECTION_REPOSITORY)
    private readonly collections: TripCollectionRepositoryPort,
    @Inject(FIELD_RECEIPT_REPOSITORY) private readonly receipts: FieldReceiptRepositoryPort,
    @Inject(TRIP_EXPENSE_REPOSITORY) private readonly expenses: TripExpenseRepositoryPort,
  ) {}

  async execute(query: GetTripClosureQuery): Promise<TripClosureSummary> {
    const trip = await this.trips.findById(query.tripId);
    if (!trip) {
      throw new TripNotFoundException();
    }
    if (trip.status !== 'fechada') {
      throw new TripMismatchException('O batimento só existe para viagem fechada.');
    }

    const [collections, allReceipts, expenses] = await Promise.all([
      this.collections.listByTrip(trip.id),
      this.receipts.listByTrip(trip.id),
      this.expenses.listByTrip(trip.id),
    ]);
    const receipts = allReceipts.filter((receipt) => receipt.status === 'efetivado');

    const blocks = computeClosureBlocks({
      initialCash: trip.initialCash,
      returnCash: trip.returnCash,
      collections,
      receipts,
      expenses,
    });

    const closure = trip.closure;
    const managerPercent = closure?.managerPercent ?? 0;

    const previousTrip = await buildPreviousTripComparison(
      {
        listTrips: (filter) => this.trips.list(filter),
        listCollections: (tripId) => this.collections.listByTrip(tripId),
        listReceipts: (tripId) => this.receipts.listByTrip(tripId),
        listExpenses: (tripId) => this.expenses.listByTrip(tripId),
      },
      trip,
      {
        received: blocks.received,
        receivedPercent:
          blocks.wallet > 0 ? round2((blocks.received / blocks.wallet) * 100) : 0,
        expensesTotal: blocks.expenses.total,
      },
    );

    return {
      cobranca: blocks.cobranca,
      recobranca: blocks.recobranca,
      interestReceived: blocks.interestReceived,
      otherReceipts: blocks.otherReceipts,
      expenses: blocks.expenses,
      cash: blocks.cash,
      commission: {
        wallet: blocks.wallet,
        received: blocks.received,
        ratioPercent:
          blocks.wallet > 0 ? round2((blocks.received / blocks.wallet) * 100) : 0,
        // Faixa NÃO recomputada — as faixas podem ter mudado depois; o pago é o persistido.
        appliedThresholdPercent: null,
        commissionPercent: closure?.commissionPercent ?? 0,
        repCommission: closure?.repCommission ?? 0,
        managerCommission: round2((blocks.received * managerPercent) / 100),
        helperAmount: closure?.helperAmount ?? 0,
        payableTitleIds: [],
      },
      previousTrip,
    };
  }
}
