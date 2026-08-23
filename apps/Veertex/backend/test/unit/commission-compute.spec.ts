import {
  ComputeModelACommissionQuery,
  ComputeModelACommissionUseCase,
} from '../../src/contexts/commission/application/use-cases/compute-model-a/compute-model-a.use-case';
import { CommissionTierRepositoryPort } from '../../src/contexts/commission/application/ports/output/commission-tier-repository.port';
import { SalesTargetRepositoryPort } from '../../src/contexts/commission/application/ports/output/sales-target-repository.port';
import { CommissionSalesLookupPort } from '../../src/contexts/commission/application/ports/output/commission-sales-lookup.port';
import {
  CommissionPayable,
  CommissionPayablePort,
} from '../../src/contexts/commission/application/ports/output/commission-payable.port';
import { SalesTarget } from '../../src/contexts/commission/domain/entities/sales-target.entity';
import { UserRepositoryPort } from '../../src/contexts/user/application/ports/output/user-repository.port';
import { User } from '../../src/contexts/user/domain/entities/user.entity';
import { CommissionModel } from '../../src/contexts/user/domain/commission-model';
import { CommissionModelMismatchException } from '../../src/contexts/commission/domain/exceptions/commission-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const VENDEDOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

/** Fake mínimo: a apuração só lê `commissionModel` do vendedor. */
function usersFalso(model: CommissionModel): UserRepositoryPort {
  return {
    findById: async () => ({ commissionModel: model }) as unknown as User,
    findByEmail: async () => null,
    save: async (u: User) => u,
  } as unknown as UserRepositoryPort;
}

const tiersFalso: CommissionTierRepositoryPort = {
  getForAccount: async () => [
    { thresholdPercent: 100, commissionPercent: 1 },
    { thresholdPercent: 150, commissionPercent: 1.5 },
    { thresholdPercent: 200, commissionPercent: 2 },
  ],
  replaceForAccount: async (_a, t) => t,
};

function metaFalso(meta: number | null): SalesTargetRepositoryPort {
  return {
    findByUserPeriod: async (userId, period) =>
      meta === null
        ? null
        : SalesTarget.reconstitute({
            id: 'x',
            accountId: CONTA,
            userId,
            period,
            targetValue: meta,
            createdAt: new Date('2026-01-01T00:00:00Z'),
          }),
    listByPeriod: async () => [],
    save: async (t) => t,
  };
}

function vendidoFalso(vendido: number): CommissionSalesLookupPort {
  return { sumSoldBySalesRep: async () => vendido };
}

function payableEspiao() {
  const emitidos: CommissionPayable[] = [];
  const port: CommissionPayablePort = { emit: (p) => emitidos.push(p) };
  return { port, emitidos };
}

describe('ComputeModelACommission — apuração (§2 do 02A)', () => {
  it('150% da meta → 1,5% sobre o vendido, e emite conta a pagar', async () => {
    const { port, emitidos } = payableEspiao();
    const uc = new ComputeModelACommissionUseCase(
      tiersFalso,
      metaFalso(100000),
      vendidoFalso(150000),
      port,
      usersFalso('a'),
    );
    const r = await uc.execute(new ComputeModelACommissionQuery(VENDEDOR, '2026-08'));
    expect(r.vendido).toBe(150000);
    expect(r.commissionValue).toBe(2250);
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].amount).toBe(2250);
  });

  it('abaixo da meta → comissão zero e NÃO emite conta a pagar', async () => {
    const { port, emitidos } = payableEspiao();
    const uc = new ComputeModelACommissionUseCase(
      tiersFalso,
      metaFalso(100000),
      vendidoFalso(90000),
      port,
      usersFalso('a'),
    );
    const r = await uc.execute(new ComputeModelACommissionQuery(VENDEDOR, '2026-08'));
    expect(r.commissionValue).toBe(0);
    expect(emitidos).toHaveLength(0);
  });

  it('sem meta cadastrada → comissão zero (Modelo A não se apura sem meta)', async () => {
    const { port, emitidos } = payableEspiao();
    const uc = new ComputeModelACommissionUseCase(
      tiersFalso,
      metaFalso(null),
      vendidoFalso(150000),
      port,
      usersFalso('a'),
    );
    const r = await uc.execute(new ComputeModelACommissionQuery(VENDEDOR, '2026-08'));
    expect(r.meta).toBe(0);
    expect(r.commissionValue).toBe(0);
    expect(emitidos).toHaveLength(0);
  });

  it('vendedor que não é Modelo A é recusado com mensagem clara (não devolve zero)', async () => {
    const { port } = payableEspiao();
    const uc = new ComputeModelACommissionUseCase(
      tiersFalso,
      metaFalso(100000),
      vendidoFalso(150000),
      port,
      usersFalso('none'),
    );
    await expect(uc.execute(new ComputeModelACommissionQuery(VENDEDOR, '2026-08'))).rejects.toThrow(
      CommissionModelMismatchException,
    );
  });
});
