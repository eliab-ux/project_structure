import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  COMMISSION_TIER_REPOSITORY,
  CommissionTierRepositoryPort,
} from '../../ports/output/commission-tier-repository.port';
import {
  SALES_TARGET_REPOSITORY,
  SalesTargetRepositoryPort,
} from '../../ports/output/sales-target-repository.port';
import {
  COMMISSION_SALES_LOOKUP,
  CommissionSalesLookupPort,
} from '../../ports/output/commission-sales-lookup.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';
import { computeModelACommission } from '../../../domain/model-a';
import { CommissionModelAResultDto } from '../../dto/commission.dto';
import {
  CommissionModelMismatchException,
  CommissionSalesRepNotFoundException,
} from '../../../domain/exceptions/commission-exceptions';

export class ComputeModelACommissionQuery {
  constructor(
    public readonly salesRepId: string,
    public readonly period: string,
  ) {}
}

/**
 * Apura a comissão do Modelo A de um vendedor num período (§2 do 02A): carrega as faixas da conta e a
 * meta do `(vendedor, período)`, soma o vendido, e roda o motor puro. Sem meta cadastrada → vendido
 * ÷ 0 → comissão zero (o motor trata).
 *
 * É LEITURA pura (apuração). Materializar a comissão como conta a pagar no FIN é o
 * `GenerateCommissionPayable` (um POST explícito) — um GET não tem efeito no financeiro.
 */
@Injectable()
export class ComputeModelACommissionUseCase implements UseCase<
  ComputeModelACommissionQuery,
  CommissionModelAResultDto
> {
  constructor(
    @Inject(COMMISSION_TIER_REPOSITORY) private readonly tiers: CommissionTierRepositoryPort,
    @Inject(SALES_TARGET_REPOSITORY) private readonly targets: SalesTargetRepositoryPort,
    @Inject(COMMISSION_SALES_LOOKUP) private readonly sales: CommissionSalesLookupPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
  ) {}

  async execute(query: ComputeModelACommissionQuery): Promise<CommissionModelAResultDto> {
    // O modelo é atributo do cadastro do vendedor (§2 do 02A): apurar A para um vendedor B/none
    // recusa com mensagem clara — não devolve zero silencioso, que esconderia um cadastro errado.
    const salesRep = await this.users.findById(UserId.from(query.salesRepId));
    if (!salesRep) {
      throw new CommissionSalesRepNotFoundException();
    }
    if (salesRep.commissionModel !== 'a') {
      throw new CommissionModelMismatchException(salesRep.commissionModel);
    }

    const tiers = await this.tiers.getForAccount();
    const target = await this.targets.findByUserPeriod(query.salesRepId, query.period);
    const vendido = await this.sales.sumSoldBySalesRep(query.salesRepId, query.period);

    const result = computeModelACommission({
      vendido,
      meta: target?.targetValue ?? 0,
      tiers,
    });

    // Apuração é LEITURA pura — não materializa título (isso é `GenerateCommissionPayable`, um POST
    // explícito). Um GET não deve ter efeito colateral no FIN.
    return CommissionModelAResultDto.build(query.salesRepId, query.period, result);
  }
}
