import {
  BuildTripWalletCommand,
  BuildTripWalletUseCase,
} from '../../src/contexts/route/application/use-cases/build-trip-wallet/build-trip-wallet.use-case';
import { TripCollection } from '../../src/contexts/route/domain/entities/trip-collection.entity';
import { TripCollectionRepositoryPort } from '../../src/contexts/route/application/ports/output/trip-collection-repository.port';
import {
  WalletTitleInfo,
  WalletTitleLookupPort,
} from '../../src/contexts/route/application/ports/output/wallet-title-lookup.port';
import { RotWalletParamsPort } from '../../src/contexts/route/application/ports/output/rot-wallet-params.port';
import { TripRepositoryPort } from '../../src/contexts/route/application/ports/output/trip-repository.port';
import { Trip } from '../../src/contexts/route/domain/entities/trip.entity';
import { FieldReceipt } from '../../src/contexts/route/domain/entities/field-receipt.entity';
import { FieldReceiptAlreadyEffectuatedException } from '../../src/contexts/route/domain/exceptions/route-exceptions';
import { FinancialTitle } from '../../src/contexts/finance/domain/entities/financial-title.entity';
import { TitleSettlement } from '../../src/contexts/finance/domain/entities/title-settlement.entity';
import { FinancialTitleRepositoryPort } from '../../src/contexts/finance/application/ports/output/financial-title-repository.port';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const ROTA = '33333333-3333-4333-8333-333333333333';
const VENDEDOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLIENTE = '55555555-5555-4555-8555-555555555555';

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

function tripFalsa(): Trip {
  return Trip.create({
    accountId: CONTA,
    companyId: EMPRESA,
    routeId: ROTA,
    salesRepId: VENDEDOR,
  });
}

function tituloConsignado(amount: number): FinancialTitle {
  return FinancialTitle.create({
    accountId: CONTA,
    companyId: EMPRESA,
    direction: 'receivable',
    contactId: CLIENTE,
    description: 'Consignação',
    amount,
    dueDate: new Date('2026-10-01T00:00:00Z'),
    origin: 'consignment',
  });
}

function collectionsFalso(previousCountByTitle: Record<string, number>) {
  const saved: TripCollection[] = [];
  const repo: TripCollectionRepositoryPort = {
    listByTrip: async (tripId) => saved.filter((c) => c.tripId === tripId),
    countByTitle: async (titleId) =>
      (previousCountByTitle[titleId] ?? 0) + saved.filter((c) => c.titleId === titleId).length,
    existsForTripTitle: async (tripId, titleId) =>
      saved.some((c) => c.tripId === tripId && c.titleId === titleId),
    save: async (c) => {
      saved.push(c);
      return c;
    },
  };
  return { repo, saved };
}

function titlesFalso(titles: FinancialTitle[]): FinancialTitleRepositoryPort {
  return {
    findById: async (id) => titles.find((t) => t.id === id) ?? null,
    list: async () => titles,
    save: async (t) => t,
  };
}

function lookupFalso(infos: WalletTitleInfo[]): WalletTitleLookupPort {
  return { findOpenConsignmentTitlesByRoute: async () => infos };
}

function paramsFalso(limit = 3): RotWalletParamsPort {
  return { recollectionLimit: async () => limit };
}

function tripsFalso(trip: Trip): TripRepositoryPort {
  return {
    findById: async () => trip,
    list: async () => [trip],
    save: async (t) => t,
  };
}

describe('BuildTripWallet — carteira e política "perdida" (§3.4 do 04)', () => {
  it('título nunca cobrado entra como COBRANÇA; já cobrado entra como RECOBRANÇA', async () => {
    const trip = tripFalsa();
    const t1 = tituloConsignado(1000);
    const t2 = tituloConsignado(500);
    const { repo } = collectionsFalso({ [t2.id]: 1 }); // t2 já foi cobrado 1×
    const uc = new BuildTripWalletUseCase(
      tripsFalso(trip),
      repo,
      lookupFalso([
        { titleId: t1.id, contactId: CLIENTE, openAmount: 1000, status: 'open' },
        { titleId: t2.id, contactId: CLIENTE, openAmount: 500, status: 'open' },
      ]),
      titlesFalso([t1, t2]),
      paramsFalso(3),
      uowFalso,
    );
    const result = await uc.execute(new BuildTripWalletCommand(CONTA, trip.id));
    expect(result.added).toHaveLength(2);
    expect(result.added.find((a) => a.titleId === t1.id)?.kind).toBe('cobranca');
    expect(result.added.find((a) => a.titleId === t2.id)?.kind).toBe('recobranca');
    expect(result.walletTotal).toBe(1500);
  });

  it('1 cobrança + 3 recobranças sem quitar → written_off_pending, SAI da carteira, FICA no FIN', async () => {
    const trip = tripFalsa();
    const perdido = tituloConsignado(800);
    const { repo, saved } = collectionsFalso({ [perdido.id]: 4 }); // 1 cobrança + 3 recobranças
    const uc = new BuildTripWalletUseCase(
      tripsFalso(trip),
      repo,
      lookupFalso([{ titleId: perdido.id, contactId: CLIENTE, openAmount: 800, status: 'open' }]),
      titlesFalso([perdido]),
      paramsFalso(3),
      uowFalso,
    );
    const result = await uc.execute(new BuildTripWalletCommand(CONTA, trip.id));
    expect(result.added).toHaveLength(0); // saiu da carteira
    expect(saved).toHaveLength(0);
    expect(result.writtenOffPending).toEqual([perdido.id]);
    expect(perdido.status).toBe('written_off_pending'); // permanece no FIN, sinalizado
  });

  it('limiar CONFIGURÁVEL: com limite 5, o mesmo título ainda viaja', async () => {
    const trip = tripFalsa();
    const titulo = tituloConsignado(800);
    const { repo } = collectionsFalso({ [titulo.id]: 4 });
    const uc = new BuildTripWalletUseCase(
      tripsFalso(trip),
      repo,
      lookupFalso([{ titleId: titulo.id, contactId: CLIENTE, openAmount: 800, status: 'open' }]),
      titlesFalso([titulo]),
      paramsFalso(5),
      uowFalso,
    );
    const result = await uc.execute(new BuildTripWalletCommand(CONTA, trip.id));
    expect(result.added).toHaveLength(1);
    expect(result.added[0].kind).toBe('recobranca');
  });

  it('remontar a carteira é idempotente (título não duplica na mesma viagem)', async () => {
    const trip = tripFalsa();
    const titulo = tituloConsignado(300);
    const { repo, saved } = collectionsFalso({});
    const uc = new BuildTripWalletUseCase(
      tripsFalso(trip),
      repo,
      lookupFalso([{ titleId: titulo.id, contactId: CLIENTE, openAmount: 300, status: 'open' }]),
      titlesFalso([titulo]),
      paramsFalso(3),
      uowFalso,
    );
    await uc.execute(new BuildTripWalletCommand(CONTA, trip.id));
    await uc.execute(new BuildTripWalletCommand(CONTA, trip.id));
    expect(saved).toHaveLength(1);
  });
});

describe('Título "perdido" — quitação vence a sinalização (§3.4 do 04)', () => {
  it('pagamento posterior de um written_off_pending é baixa normal → settled', () => {
    const titulo = tituloConsignado(100);
    titulo.flagWrittenOffPending();
    expect(titulo.status).toBe('written_off_pending');
    titulo.addSettlement(
      TitleSettlement.create({
        financialAccountId: '99999999-9999-4999-8999-999999999999',
        method: 'pix',
        principal: 100,
        settledAt: new Date(),
      }),
    );
    expect(titulo.status).toBe('settled');
  });
});

describe('FieldReceipt — dois estágios (§3.3 do 04)', () => {
  it('nasce proposto; efetivar muda o estágio uma única vez', () => {
    const receipt = FieldReceipt.create({
      accountId: CONTA,
      tripId: 'trip',
      titleId: 'title',
      method: 'dinheiro',
      amount: 150,
    });
    expect(receipt.status).toBe('proposto');
    expect(receipt.insideWallet).toBe(true);
    receipt.effectuate();
    expect(receipt.status).toBe('efetivado');
    expect(() => receipt.effectuate()).toThrow(FieldReceiptAlreadyEffectuatedException);
  });

  it('recebimento sem título = "outros recebimentos", FORA da carteira', () => {
    const receipt = FieldReceipt.create({
      accountId: CONTA,
      tripId: 'trip',
      method: 'pix',
      amount: 80,
    });
    expect(receipt.insideWallet).toBe(false);
  });
});
