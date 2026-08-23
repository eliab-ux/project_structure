import {
  RegisterFieldReceiptCommand,
  RegisterFieldReceiptUseCase,
} from '../../src/contexts/route/application/use-cases/register-field-receipt/register-field-receipt.use-case';
import { FieldReceipt } from '../../src/contexts/route/domain/entities/field-receipt.entity';
import { Trip } from '../../src/contexts/route/domain/entities/trip.entity';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const ROTA = '33333333-3333-4333-8333-333333333333';
const VENDEDOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLIENT_UUID = 'c11e0000-0000-4000-8000-000000000001';

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

/**
 * Idempotência do sync de campo (proposta do app aprovada em 23/08/2026, antecipada na Leva 2):
 * a outbox reenvia após queda de rede, e o reenvio com o MESMO client_uuid devolve o registro
 * existente — nunca um segundo lançamento.
 */
describe('client_uuid — reenvio da outbox não duplica lançamento de campo', () => {
  function viagem(): Trip {
    const trip = Trip.create({
      accountId: CONTA,
      companyId: EMPRESA,
      routeId: ROTA,
      salesRepId: VENDEDOR,
    });
    trip.depart();
    return trip;
  }

  function fakes() {
    const trip = viagem();
    const porUuid = new Map<string, FieldReceipt>();
    const saves: FieldReceipt[] = [];
    const receipts = {
      findById: async () => null,
      listByTrip: async () => saves,
      findByClientUuid: async (uuid: string) => porUuid.get(uuid) ?? null,
      save: async (receipt: FieldReceipt, options?: { clientUuid?: string | null }) => {
        saves.push(receipt);
        if (options?.clientUuid) {
          porUuid.set(options.clientUuid, receipt);
        }
        return receipt;
      },
    };
    const trips = { findById: async () => trip, list: async () => [trip], save: async (t: Trip) => t };
    const collections = {
      listByTrip: async () => [],
      countByTitle: async () => 0,
      existsForTripTitle: async () => false,
      save: async (c: never) => c,
    };
    return { trip, receipts, trips, collections, saves };
  }

  it('mesmo client_uuid duas vezes → UM lançamento, e o segundo retorno é o existente', async () => {
    const f = fakes();
    const uc = new RegisterFieldReceiptUseCase(f.receipts as never, f.trips as never, uowFalso);
    const cmd = () =>
      new RegisterFieldReceiptCommand(CONTA, {
        tripId: f.trip.id,
        titleId: null,
        method: 'pix',
        amount: 150,
        clientUuid: CLIENT_UUID,
      });

    const first = await uc.execute(cmd());
    const second = await uc.execute(cmd());

    expect(f.saves).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.status).toBe(first.status);
  });

  it('sem client_uuid, dois envios são DOIS lançamentos (retaguarda digitando duas vezes é intenção)', async () => {
    const f = fakes();
    const uc = new RegisterFieldReceiptUseCase(f.receipts as never, f.trips as never, uowFalso);
    const cmd = () =>
      new RegisterFieldReceiptCommand(CONTA, {
        tripId: f.trip.id,
        titleId: null,
        method: 'pix',
        amount: 150,
      });
    await uc.execute(cmd());
    await uc.execute(cmd());
    expect(f.saves).toHaveLength(2);
  });
});
