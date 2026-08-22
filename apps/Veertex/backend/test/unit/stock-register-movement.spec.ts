import {
  RegisterMovementUseCase,
  RegisterMovementCommand,
} from '../../src/contexts/stock/application/use-cases/register-movement/register-movement.use-case';
import { StockMovement } from '../../src/contexts/stock/domain/entities/stock-movement.entity';
import { StockMovementType } from '../../src/contexts/stock/domain/movement-type';
import { StockMovementRepositoryPort } from '../../src/contexts/stock/application/ports/output/stock-movement-repository.port';
import { StockProductLookupPort } from '../../src/contexts/stock/application/ports/output/stock-product-lookup.port';
import { AccountPreferencesReader } from '../../src/contexts/account/application/account-preferences.reader';
import { AccountPreferences } from '../../src/contexts/account/domain/value-objects/account-preferences.vo';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';
import { NegativeStockNotAllowedException } from '../../src/contexts/stock/domain/exceptions/stock-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const PRODUTO = '44444444-4444-4444-8444-444444444444';

function repoFalso(inicial: StockMovement[] = []) {
  const salvos = [...inicial];
  const repo: StockMovementRepositoryPort = {
    listByCompanyProduct: async (companyId, productId) =>
      salvos.filter((m) => m.companyId === companyId && m.productId === productId),
    findById: async (id) => salvos.find((m) => m.id === id) ?? null,
    save: async (m) => {
      salvos.push(m);
      return m;
    },
    list: async () => salvos,
  };
  return { repo, salvos };
}

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

function prefsFalso(stockAllowNegative = false): AccountPreferencesReader {
  return {
    forAccount: async () => AccountPreferences.create({ stockAllowNegative }),
  } as unknown as AccountPreferencesReader;
}

const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;

function uc(repo: StockMovementRepositoryPort, prefs = prefsFalso()) {
  return new RegisterMovementUseCase(repo, produtoFalso, prefs, uowFalso);
}

function cmd(
  type: StockMovementType,
  quantity: number,
  over: Partial<RegisterMovementCommand> = {},
) {
  return new RegisterMovementCommand(
    CONTA,
    EMPRESA,
    PRODUTO,
    type,
    quantity,
    over.unitCost ?? null,
    over.relatedMovementId ?? null,
  );
}

describe('RegisterMovementUseCase — custo e negativo (§3.4 / §3.2)', () => {
  it('compra guarda o custo do input (0 = bonificação)', async () => {
    const { repo, salvos } = repoFalso();
    const dto = await uc(repo).execute(cmd('purchase_in', 10, { unitCost: 2 }));
    expect(dto.unitCost).toBe(2);
    expect(salvos).toHaveLength(1);
  });

  it('venda estampa o custo médio da ÉPOCA', async () => {
    const { repo } = repoFalso();
    await uc(repo).execute(cmd('purchase_in', 10, { unitCost: 3 }));
    const venda = await uc(repo).execute(cmd('sale_out', 4));
    expect(venda.unitCost).toBe(3); // média vigente virou o custo consumido da venda
  });

  it('bloqueia saída que deixaria negativo (default)', async () => {
    const { repo } = repoFalso();
    await uc(repo).execute(cmd('purchase_in', 5, { unitCost: 1 }));
    await expect(uc(repo).execute(cmd('sale_out', 8))).rejects.toThrow(
      NegativeStockNotAllowedException,
    );
  });

  it('permite negativo quando a preferência liga', async () => {
    const { repo } = repoFalso();
    await uc(repo).execute(cmd('purchase_in', 5, { unitCost: 1 }));
    const venda = await uc(repo, prefsFalso(true)).execute(cmd('sale_out', 8));
    expect(venda.type).toBe('sale_out');
  });

  it('devolução de cliente reentra pelo custo da época do movimento original', async () => {
    const { repo } = repoFalso();
    await uc(repo).execute(cmd('purchase_in', 10, { unitCost: 5 }));
    const venda = await uc(repo).execute(cmd('sale_out', 4)); // custo consumido = 5
    const devolucao = await uc(repo).execute(
      cmd('customer_return', 2, { relatedMovementId: venda.id }),
    );
    expect(devolucao.unitCost).toBe(5);
    expect(devolucao.usedFallback).toBe(false);
  });

  it('devolução sem origem cai no fallback e MARCA usedFallback (§3.4)', async () => {
    const { repo } = repoFalso();
    await uc(repo).execute(cmd('purchase_in', 10, { unitCost: 5 }));
    const devolucao = await uc(repo).execute(cmd('customer_return', 2));
    expect(devolucao.usedFallback).toBe(true);
    expect(devolucao.unitCost).toBe(5); // média vigente
  });
});
