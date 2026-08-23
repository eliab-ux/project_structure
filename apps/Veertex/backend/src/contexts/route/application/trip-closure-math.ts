import { round2 } from '../../commission/domain/model-a';

/**
 * A MATEMÁTICA do batimento (§3.5 do 04), extraída para função única: o fechamento (`CloseTrip`) e
 * a RE-EXIBIÇÃO do batimento de viagem fechada (`GetTripClosure`) usam a MESMA — é isso que torna a
 * recomputação determinística (decisão registrada de 23/08/2026: recomputar dos dados persistidos,
 * não snapshot; os inputs manuais persistem em `closure_*`, o resto é append-only).
 */

export interface ClosureCollectionRow {
  titleId: string;
  kind: string;
  amountAtBuild: number;
}

export interface ClosureReceiptRow {
  titleId: string | null;
  method: string;
  amount: number;
  interest: number;
  insideWallet: boolean;
}

export interface ClosureExpenseRow {
  category: string;
  amount: number;
}

export interface ClosureBlocks {
  cobranca: { wallet: number; received: number; percent: number };
  recobranca: { wallet: number; received: number; percent: number };
  interestReceived: number;
  otherReceipts: number;
  expenses: { byCategory: Record<string, number>; total: number; percentOfReceived: number };
  cash: { expected: number; counted: number | null; difference: number | null };
  wallet: number;
  received: number;
}

export function computeClosureBlocks(params: {
  initialCash: number;
  returnCash: number | null;
  collections: ClosureCollectionRow[];
  /** SÓ os recebimentos EFETIVADOS — o chamador filtra (proposto não é dinheiro). */
  receipts: ClosureReceiptRow[];
  expenses: ClosureExpenseRow[];
}): ClosureBlocks {
  const walletByKind: Record<'cobranca' | 'recobranca', number> = { cobranca: 0, recobranca: 0 };
  const titleKind = new Map<string, 'cobranca' | 'recobranca'>();
  for (const collection of params.collections) {
    const kind = collection.kind === 'recobranca' ? 'recobranca' : 'cobranca';
    walletByKind[kind] += collection.amountAtBuild;
    titleKind.set(collection.titleId, kind);
  }

  const receivedByKind: Record<'cobranca' | 'recobranca', number> = { cobranca: 0, recobranca: 0 };
  let interestReceived = 0;
  let otherReceipts = 0;
  for (const receipt of params.receipts) {
    if (receipt.insideWallet && receipt.titleId) {
      const kind = titleKind.get(receipt.titleId) ?? 'cobranca';
      receivedByKind[kind] += receipt.amount;
      interestReceived += receipt.interest;
    } else {
      otherReceipts += receipt.amount;
    }
  }

  const byCategory: Record<string, number> = {};
  let expensesTotal = 0;
  for (const expense of params.expenses) {
    byCategory[expense.category] = round2((byCategory[expense.category] ?? 0) + expense.amount);
    expensesTotal += expense.amount;
  }

  const wallet = round2(walletByKind.cobranca + walletByKind.recobranca);
  const received = round2(receivedByKind.cobranca + receivedByKind.recobranca);
  const totalCashIn = round2(received + interestReceived + otherReceipts);

  const cashReceipts = params.receipts
    .filter((receipt) => receipt.method === 'dinheiro')
    .reduce((sum, receipt) => sum + receipt.amount + receipt.interest, 0);
  const expectedCash = round2(params.initialCash + cashReceipts - expensesTotal);
  const countedCash = params.returnCash;
  const cashDifference = countedCash === null ? null : round2(countedCash - expectedCash);

  const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

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
    wallet,
    received,
  };
}

export interface PreviousTripComparison {
  tripId: string;
  departureAt: string | null;
  wallet: number;
  received: number;
  receivedPercent: number;
  expensesTotal: number;
  deltas: { received: number; receivedPercent: number; expensesTotal: number };
}

interface PreviousTripDeps {
  listTrips(filter: { routeId: string; status: string }): Promise<
    { id: string; departureAt: Date | null; createdAt: Date }[]
  >;
  listCollections(tripId: string): Promise<ClosureCollectionRow[]>;
  listReceipts(tripId: string): Promise<(ClosureReceiptRow & { status: string })[]>;
  listExpenses(tripId: string): Promise<ClosureExpenseRow[]>;
}

/**
 * A viagem anterior = a última FECHADA da mesma rota que saiu antes desta. Números recomputados
 * das cobranças/recebimentos append-only (mesma régua do fechamento). `null` = primeira viagem.
 * Compartilhada entre o fechamento e a re-exibição — mesma razão da `computeClosureBlocks`.
 */
export async function buildPreviousTripComparison(
  deps: PreviousTripDeps,
  trip: { id: string; routeId: string; departureAt: Date | null; createdAt: Date },
  current: { received: number; receivedPercent: number; expensesTotal: number },
): Promise<PreviousTripComparison | null> {
  const closed = await deps.listTrips({ routeId: trip.routeId, status: 'fechada' });
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

  const collections = await deps.listCollections(previous.id);
  const walletTitleIds = new Set(collections.map((collection) => collection.titleId));
  const wallet = round2(collections.reduce((sum, collection) => sum + collection.amountAtBuild, 0));

  const receipts = (await deps.listReceipts(previous.id)).filter(
    (receipt) => receipt.status === 'efetivado',
  );
  const received = round2(
    receipts
      .filter((receipt) => receipt.insideWallet && receipt.titleId && walletTitleIds.has(receipt.titleId))
      .reduce((sum, receipt) => sum + receipt.amount, 0),
  );

  const expensesTotal = round2(
    (await deps.listExpenses(previous.id)).reduce((sum, expense) => sum + expense.amount, 0),
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
