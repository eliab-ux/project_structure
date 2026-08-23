import { StockReservation } from '../../src/contexts/stock/domain/entities/stock-reservation.entity';
import {
  ListStockReservationsQuery,
  ListStockReservationsUseCase,
} from '../../src/contexts/stock/application/use-cases/list-stock-reservations/list-stock-reservations.use-case';
import { StockReservationRepositoryPort } from '../../src/contexts/stock/application/ports/output/stock-reservation-repository.port';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const PRODUTO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function reserva(ttlHours: number): StockReservation {
  return StockReservation.create({
    accountId: CONTA,
    companyId: EMPRESA,
    productId: PRODUTO,
    orderId: null,
    quantity: 5,
    ttlHours,
    now: new Date(Date.now() - (ttlHours < 0 ? 0 : 0)),
  });
}

describe('Reservas — expiração VISÍVEL na leitura (02 §3.9, requisito de 22/08/2026)', () => {
  it('reserva ativa vencida é MARCADA released/expired na listagem — nunca some em silêncio', async () => {
    // TTL de 0h: nasce vencida — o caso-limite que o TTL silencioso esconderia.
    const vencida = reserva(0);
    const vigente = reserva(72);
    const releases: StockReservation[][] = [];
    const repo: StockReservationRepositoryPort = {
      sumActiveReserved: async () => 0,
      list: async () => [vencida, vigente],
      findActiveByOrder: async () => [],
      save: async () => undefined,
      saveReleases: async (rows) => {
        releases.push([...rows]);
      },
    };
    const uc = new ListStockReservationsUseCase(repo);
    const result = await uc.execute(new ListStockReservationsQuery({ companyId: EMPRESA }));

    // A vencida foi PERSISTIDA como released/expired — evento auditável, não estado fantasma.
    expect(releases).toHaveLength(1);
    expect(releases[0][0].status).toBe('released');
    expect(releases[0][0].releaseReason).toBe('expired');

    const dtoVencida = result.find((row) => row.id === vencida.id);
    expect(dtoVencida?.status).toBe('released');
    expect(dtoVencida?.releaseReason).toBe('expired');
    expect(dtoVencida?.expiredNow).toBe(true);

    const dtoVigente = result.find((row) => row.id === vigente.id);
    expect(dtoVigente?.status).toBe('active');
    expect(dtoVigente?.expiredNow).toBe(false);
  });

  it('sem vencidas, nada é gravado — a leitura não inventa escrita', async () => {
    const vigente = reserva(72);
    let saved = 0;
    const repo: StockReservationRepositoryPort = {
      sumActiveReserved: async () => 0,
      list: async () => [vigente],
      findActiveByOrder: async () => [],
      save: async () => undefined,
      saveReleases: async () => {
        saved += 1;
      },
    };
    const uc = new ListStockReservationsUseCase(repo);
    await uc.execute(new ListStockReservationsQuery());
    expect(saved).toBe(0);
  });
});
