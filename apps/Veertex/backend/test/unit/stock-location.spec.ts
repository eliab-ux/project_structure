import {
  RegisterMovementUseCase,
  RegisterMovementCommand,
} from '../../src/contexts/stock/application/use-cases/register-movement/register-movement.use-case';
import {
  TransferStockUseCase,
  TransferStockCommand,
} from '../../src/contexts/stock/application/use-cases/transfer-stock/transfer-stock.use-case';
import {
  GetStockBalanceUseCase,
  GetStockBalanceQuery,
} from '../../src/contexts/stock/application/use-cases/get-stock-balance/get-stock-balance.use-case';
import { StockMovement } from '../../src/contexts/stock/domain/entities/stock-movement.entity';
import { StockLocation } from '../../src/contexts/stock/domain/entities/stock-location.entity';
import { StockMovementRepositoryPort } from '../../src/contexts/stock/application/ports/output/stock-movement-repository.port';
import { StockLocationRepositoryPort } from '../../src/contexts/stock/application/ports/output/stock-location-repository.port';
import { StockProductLookupPort } from '../../src/contexts/stock/application/ports/output/stock-product-lookup.port';
import { StockReservationRepositoryPort } from '../../src/contexts/stock/application/ports/output/stock-reservation-repository.port';
import { AccountPreferencesReader } from '../../src/contexts/account/application/account-preferences.reader';
import { AccountPreferences } from '../../src/contexts/account/domain/value-objects/account-preferences.vo';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';
import {
  MovementTypeNotRegisterableException,
  NegativeStockNotAllowedException,
  SameLocationTransferException,
  StockLocationInvalidException,
} from '../../src/contexts/stock/domain/exceptions/stock-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const OUTRA_EMPRESA = '33333333-3333-4333-8333-333333333333';
const PRODUTO = '44444444-4444-4444-8444-444444444444';
const DEPOSITO = '55555555-5555-4555-8555-555555555555';
const CARGA = '66666666-6666-4666-8666-666666666666';

function repoFalso(inicial: StockMovement[] = []) {
  const salvos = [...inicial];
  const repo: StockMovementRepositoryPort = {
    listByCompanyProduct: async (companyId, productId) =>
      salvos.filter((m) => m.companyId === companyId && m.productId === productId),
    listByCompanyProductLocation: async (companyId, productId, locationId) =>
      salvos.filter(
        (m) =>
          m.companyId === companyId && m.productId === productId && m.locationId === locationId,
      ),
    findById: async (id) => salvos.find((m) => m.id === id) ?? null,
    save: async (m) => {
      salvos.push(m);
      return m;
    },
    list: async () => salvos,
  };
  return { repo, salvos };
}

// Duas localizações da MESMA empresa; qualquer outro id não existe.
const locais: Record<string, StockLocation> = {
  [DEPOSITO]: StockLocation.reconstitute({
    id: DEPOSITO,
    accountId: CONTA,
    companyId: EMPRESA,
    kind: 'warehouse',
    name: 'Depósito principal',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }),
  [CARGA]: StockLocation.reconstitute({
    id: CARGA,
    accountId: CONTA,
    companyId: EMPRESA,
    kind: 'warehouse',
    name: 'Depósito 2',
    active: true,
    createdAt: new Date('2026-01-02T00:00:00Z'),
  }),
};

const localFalso: StockLocationRepositoryPort = {
  findById: async (id) => locais[id] ?? null,
  listByCompany: async () => Object.values(locais),
  findDefaultWarehouse: async () => locais[DEPOSITO],
  save: async (l) => l,
};

const produtoFalso: StockProductLookupPort = {
  findById: async (id) => ({
    id,
    name: 'Chapa',
    minimumQuantity: null,
    maximumQuantity: null,
    active: true,
    isBundle: false,
    components: [],
  }),
};

const reservasFalso: StockReservationRepositoryPort = {
  list: async () => [],
  sumActiveReserved: async () => 0,
  findActiveByOrder: async () => [],
  save: async () => undefined,
  saveReleases: async () => undefined,
};

function prefsFalso(stockAllowNegative = false): AccountPreferencesReader {
  return {
    forAccount: async () => AccountPreferences.create({ stockAllowNegative }),
  } as unknown as AccountPreferencesReader;
}

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

function registrar(repo: StockMovementRepositoryPort, prefs = prefsFalso()) {
  return new RegisterMovementUseCase(repo, produtoFalso, localFalso, prefs, uowFalso);
}
function transferir(repo: StockMovementRepositoryPort, prefs = prefsFalso()) {
  return new TransferStockUseCase(repo, localFalso, produtoFalso, prefs, uowFalso);
}
function saldo(repo: StockMovementRepositoryPort) {
  return new GetStockBalanceUseCase(repo, produtoFalso, reservasFalso);
}

function entrada(locationId: string, qty: number, cost: number) {
  return new RegisterMovementCommand(CONTA, EMPRESA, PRODUTO, locationId, 'purchase_in', qty, cost);
}

describe('Localização de estoque — registro (§2 do 03A)', () => {
  it('recusa registro em localização inexistente', async () => {
    const { repo } = repoFalso();
    const desconhecida = '99999999-9999-4999-8999-999999999999';
    await expect(
      registrar(repo).execute(
        new RegisterMovementCommand(CONTA, EMPRESA, PRODUTO, desconhecida, 'purchase_in', 5, 1),
      ),
    ).rejects.toThrow(StockLocationInvalidException);
  });

  it('recusa registro em localização de OUTRA empresa', async () => {
    const { repo } = repoFalso();
    await expect(
      registrar(repo).execute(
        new RegisterMovementCommand(CONTA, OUTRA_EMPRESA, PRODUTO, DEPOSITO, 'purchase_in', 5, 1),
      ),
    ).rejects.toThrow(StockLocationInvalidException);
  });

  it('recusa tipo não-registrável (transferência entra por use case próprio)', async () => {
    const { repo } = repoFalso();
    await expect(
      registrar(repo).execute(
        new RegisterMovementCommand(CONTA, EMPRESA, PRODUTO, DEPOSITO, 'transfer_out', 5, 1),
      ),
    ).rejects.toThrow(MovementTypeNotRegisterableException);
  });

  it('o negativo é aferido POR localização, não pela soma da empresa', async () => {
    const { repo } = repoFalso();
    // 10 no DEPOSITO; a CARGA está zerada.
    await registrar(repo).execute(entrada(DEPOSITO, 10, 1));
    // Vender 3 da CARGA (vazia) tem que bloquear, ainda que a empresa tenha 10 no total.
    await expect(
      registrar(repo).execute(
        new RegisterMovementCommand(CONTA, EMPRESA, PRODUTO, CARGA, 'sale_out', 3),
      ),
    ).rejects.toThrow(NegativeStockNotAllowedException);
  });
});

describe('TransferStock — par atômico entre localizações (§2 do 03A)', () => {
  it('move a quantidade entre locais e mantém total e custo médio da EMPRESA', async () => {
    const { repo } = repoFalso();
    await registrar(repo).execute(entrada(DEPOSITO, 10, 2));

    const result = await transferir(repo).execute(
      new TransferStockCommand(CONTA, EMPRESA, PRODUTO, DEPOSITO, CARGA, 4),
    );
    expect(result.out.type).toBe('transfer_out');
    expect(result.in.type).toBe('transfer_in');
    // A entrada aponta a saída — o par é rastreável.
    expect(result.in.relatedMovementId).toBe(result.out.id);

    const empresa = await saldo(repo).execute(new GetStockBalanceQuery(EMPRESA, PRODUTO));
    expect(empresa.quantity).toBe(10); // total inalterado
    expect(empresa.averageCost).toBe(2); // média inalterada

    const noDeposito = await saldo(repo).execute(
      new GetStockBalanceQuery(EMPRESA, PRODUTO, DEPOSITO),
    );
    const naCarga = await saldo(repo).execute(new GetStockBalanceQuery(EMPRESA, PRODUTO, CARGA));
    expect(noDeposito.quantity).toBe(6);
    expect(naCarga.quantity).toBe(4);
  });

  it('bloqueia transferência que deixaria a ORIGEM negativa', async () => {
    const { repo } = repoFalso();
    await registrar(repo).execute(entrada(DEPOSITO, 5, 1));
    await expect(
      transferir(repo).execute(
        new TransferStockCommand(CONTA, EMPRESA, PRODUTO, DEPOSITO, CARGA, 8),
      ),
    ).rejects.toThrow(NegativeStockNotAllowedException);
  });

  it('recusa transferência para a MESMA localização', async () => {
    const { repo } = repoFalso();
    await registrar(repo).execute(entrada(DEPOSITO, 5, 1));
    await expect(
      transferir(repo).execute(
        new TransferStockCommand(CONTA, EMPRESA, PRODUTO, DEPOSITO, DEPOSITO, 2),
      ),
    ).rejects.toThrow(SameLocationTransferException);
  });

  it('recusa transferência com localização de outra empresa', async () => {
    const { repo } = repoFalso();
    await registrar(repo).execute(entrada(DEPOSITO, 5, 1));
    const foraDaEmpresa = '99999999-9999-4999-8999-999999999999';
    await expect(
      transferir(repo).execute(
        new TransferStockCommand(CONTA, EMPRESA, PRODUTO, DEPOSITO, foraDaEmpresa, 2),
      ),
    ).rejects.toThrow(StockLocationInvalidException);
  });
});
