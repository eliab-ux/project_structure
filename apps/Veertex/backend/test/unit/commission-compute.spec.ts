import {
  ComputeModelACommissionQuery,
  ComputeModelACommissionUseCase,
} from '../../src/contexts/commission/application/use-cases/compute-model-a/compute-model-a.use-case';
import {
  GenerateCommissionPayableCommand,
  GenerateCommissionPayableUseCase,
} from '../../src/contexts/commission/application/use-cases/generate-commission-payable/generate-commission-payable.use-case';
import { CommissionTierRepositoryPort } from '../../src/contexts/commission/application/ports/output/commission-tier-repository.port';
import { SalesTargetRepositoryPort } from '../../src/contexts/commission/application/ports/output/sales-target-repository.port';
import { CommissionSalesLookupPort } from '../../src/contexts/commission/application/ports/output/commission-sales-lookup.port';
import {
  CommissionPayablePort,
  CommissionPayableRequest,
} from '../../src/contexts/commission/application/ports/output/commission-payable.port';
import { SalesTarget } from '../../src/contexts/commission/domain/entities/sales-target.entity';
import { UserRepositoryPort } from '../../src/contexts/user/application/ports/output/user-repository.port';
import { User } from '../../src/contexts/user/domain/entities/user.entity';
import { CommissionModel } from '../../src/contexts/user/domain/commission-model';
import { CommissionModelMismatchException } from '../../src/contexts/commission/domain/exceptions/commission-exceptions';

const CONTA = '11111111-1111-4111-8111-111111111111';
const VENDEDOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const EMPRESA = '22222222-2222-4222-8222-222222222222';

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

function computeUC(meta: number | null, vendido: number, model: CommissionModel = 'a') {
  return new ComputeModelACommissionUseCase(
    tiersFalso,
    metaFalso(meta),
    vendidoFalso(vendido),
    usersFalso(model),
  );
}

describe('ComputeModelACommission — apuração pura (§2 do 02A)', () => {
  it('150% da meta → 1,5% sobre o vendido, sem efeito colateral', async () => {
    const r = await computeUC(100000, 150000).execute(
      new ComputeModelACommissionQuery(VENDEDOR, '2026-08'),
    );
    expect(r.vendido).toBe(150000);
    expect(r.commissionValue).toBe(2250);
    expect(r.payableTitleId).toBeNull();
  });

  it('abaixo da meta → comissão zero', async () => {
    const r = await computeUC(100000, 90000).execute(
      new ComputeModelACommissionQuery(VENDEDOR, '2026-08'),
    );
    expect(r.commissionValue).toBe(0);
  });

  it('sem meta cadastrada → comissão zero (Modelo A não se apura sem meta)', async () => {
    const r = await computeUC(null, 150000).execute(
      new ComputeModelACommissionQuery(VENDEDOR, '2026-08'),
    );
    expect(r.meta).toBe(0);
    expect(r.commissionValue).toBe(0);
  });

  it('vendedor que não é Modelo A é recusado com mensagem clara', async () => {
    await expect(
      computeUC(100000, 150000, 'none').execute(
        new ComputeModelACommissionQuery(VENDEDOR, '2026-08'),
      ),
    ).rejects.toThrow(CommissionModelMismatchException);
  });
});

describe('GenerateCommissionPayable — materializa a conta a pagar (§2.2 do 05)', () => {
  function payableEspiao() {
    const requests: CommissionPayableRequest[] = [];
    const port: CommissionPayablePort = {
      materialize: async (req) => {
        requests.push(req);
        return 'title-1';
      },
    };
    return { port, requests };
  }

  it('comissão > 0 gera título a pagar na empresa escolhida', async () => {
    const { port, requests } = payableEspiao();
    const uc = new GenerateCommissionPayableUseCase(computeUC(100000, 150000), port);
    const r = await uc.execute(
      new GenerateCommissionPayableCommand(CONTA, VENDEDOR, '2026-08', EMPRESA),
    );
    expect(r.commissionValue).toBe(2250);
    expect(r.payableTitleId).toBe('title-1');
    expect(requests).toHaveLength(1);
    expect(requests[0].amount).toBe(2250);
    expect(requests[0].companyId).toBe(EMPRESA);
  });

  it('comissão zero NÃO gera título', async () => {
    const { port, requests } = payableEspiao();
    const uc = new GenerateCommissionPayableUseCase(computeUC(100000, 90000), port);
    const r = await uc.execute(
      new GenerateCommissionPayableCommand(CONTA, VENDEDOR, '2026-08', EMPRESA),
    );
    expect(r.commissionValue).toBe(0);
    expect(r.payableTitleId).toBeNull();
    expect(requests).toHaveLength(0);
  });
});
