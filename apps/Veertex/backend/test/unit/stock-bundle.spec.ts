import {
  GetStockBalanceUseCase,
  GetStockBalanceQuery,
} from '../../src/contexts/stock/application/use-cases/get-stock-balance/get-stock-balance.use-case';
import {
  SetBundleComponentsUseCase,
  SetBundleComponentsCommand,
} from '../../src/contexts/product/application/use-cases/set-bundle-components/set-bundle-components.use-case';
import { StockMovement } from '../../src/contexts/stock/domain/entities/stock-movement.entity';
import { StockMovementRepositoryPort } from '../../src/contexts/stock/application/ports/output/stock-movement-repository.port';
import { StockReservationRepositoryPort } from '../../src/contexts/stock/application/ports/output/stock-reservation-repository.port';
import { StockProductLookupPort } from '../../src/contexts/stock/application/ports/output/stock-product-lookup.port';
import { ProductRepositoryPort } from '../../src/contexts/product/application/ports/output/product-repository.port';
import { ProductComponentRepositoryPort } from '../../src/contexts/product/application/ports/output/product-component-repository.port';
import { UnitOfWorkPort } from '../../src/infrastructure/persistence/ports/unit-of-work.port';
import {
  InvalidKitComponentException,
  NotABundleException,
} from '../../src/contexts/product/domain/exceptions/product-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const EMPRESA = '22222222-2222-4222-8222-222222222222';
const KIT = '55555555-5555-4555-8555-555555555555';
const COMP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function purchase(productId: string, qty: number): StockMovement {
  return StockMovement.create({
    accountId: CONTA,
    companyId: EMPRESA,
    productId,
    type: 'purchase_in',
    signedQuantity: qty,
    unitCost: 1,
  });
}

describe('Kit — disponível derivado dos componentes (§2.5)', () => {
  const movements: StockMovementRepositoryPort = {
    listByCompanyProduct: async (_c, productId) => {
      if (productId === COMP_A) return [purchase(COMP_A, 10)];
      if (productId === COMP_B) return [purchase(COMP_B, 6)];
      return [];
    },
    findById: async () => null,
    save: async (m) => m,
    list: async () => [],
  };
  const reservations: StockReservationRepositoryPort = {
    sumActiveReserved: async () => 0,
    findActiveByOrder: async () => [],
    save: async () => undefined,
    saveReleases: async () => undefined,
  };
  const products: StockProductLookupPort = {
    findById: async (id) => ({
      id,
      name: 'Cesta',
      minimumQuantity: null,
      maximumQuantity: null,
      active: true,
      isBundle: true,
      components: [
        { productId: COMP_A, quantity: 2 },
        { productId: COMP_B, quantity: 3 },
      ],
    }),
  };

  it('o disponível do kit é o gargalo: floor(10/2)=5, floor(6/3)=2 → 2', async () => {
    const uc = new GetStockBalanceUseCase(movements, products, reservations);
    const dto = await uc.execute(new GetStockBalanceQuery(EMPRESA, KIT));
    expect(dto.available).toBe(2);
    expect(dto.quantity).toBe(2);
    // custo de montagem = 2*1 + 3*1 = 5
    expect(dto.averageCost).toBe(5);
  });
});

describe('SetBundleComponents — guardas de domínio (§2.5)', () => {
  const uowFalso: UnitOfWorkPort = { execute: async (fn) => fn() } as UnitOfWorkPort;
  const componentsRepo: ProductComponentRepositoryPort = {
    findByParent: async () => [],
    replaceForParent: async () => undefined,
  };

  function productsRepo(formatById: Record<string, string>): ProductRepositoryPort {
    return {
      findById: async (id) => {
        const format = formatById[id.value];
        if (!format) return null;
        return { format, active: true, name: `p-${id.value.slice(0, 4)}` } as never;
      },
      findBySku: async () => null,
      findByBarcode: async () => null,
      list: async () => [],
      save: async (p) => p,
    };
  }

  function uc(formatById: Record<string, string>) {
    return new SetBundleComponentsUseCase(productsRepo(formatById), componentsRepo, uowFalso);
  }

  it('recusa se o pai não é kit', async () => {
    await expect(
      uc({ [KIT]: 'simple' }).execute(
        new SetBundleComponentsCommand(CONTA, KIT, [{ componentProductId: COMP_A, quantity: 1 }]),
      ),
    ).rejects.toThrow(NotABundleException);
  });

  it('recusa componente que é kit (kit de kit)', async () => {
    await expect(
      uc({ [KIT]: 'bundle', [COMP_A]: 'bundle' }).execute(
        new SetBundleComponentsCommand(CONTA, KIT, [{ componentProductId: COMP_A, quantity: 1 }]),
      ),
    ).rejects.toThrow(InvalidKitComponentException);
  });

  it('recusa o kit contendo ele mesmo', async () => {
    await expect(
      uc({ [KIT]: 'bundle' }).execute(
        new SetBundleComponentsCommand(CONTA, KIT, [{ componentProductId: KIT, quantity: 1 }]),
      ),
    ).rejects.toThrow(InvalidKitComponentException);
  });

  it('recusa quantidade zero', async () => {
    await expect(
      uc({ [KIT]: 'bundle', [COMP_A]: 'simple' }).execute(
        new SetBundleComponentsCommand(CONTA, KIT, [{ componentProductId: COMP_A, quantity: 0 }]),
      ),
    ).rejects.toThrow(InvalidKitComponentException);
  });

  it('aceita composição válida', async () => {
    await expect(
      uc({ [KIT]: 'bundle', [COMP_A]: 'simple', [COMP_B]: 'simple' }).execute(
        new SetBundleComponentsCommand(CONTA, KIT, [
          { componentProductId: COMP_A, quantity: 2 },
          { componentProductId: COMP_B, quantity: 3 },
        ]),
      ),
    ).resolves.toBeUndefined();
  });
});
