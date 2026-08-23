import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  COMMISSION_PAYABLE,
  CommissionPayablePort,
} from '../../ports/output/commission-payable.port';
import {
  ComputeModelACommissionQuery,
  ComputeModelACommissionUseCase,
} from '../compute-model-a/compute-model-a.use-case';
import { CommissionModelAResultDto } from '../../dto/commission.dto';

export class GenerateCommissionPayableCommand {
  constructor(
    public readonly accountId: string,
    public readonly salesRepId: string,
    public readonly period: string,
    /** Empresa que paga a comissão — escolhida pelo operador (o título pertence a uma empresa). */
    public readonly companyId: string,
  ) {}
}

/**
 * Materializa a comissão do Modelo A como CONTA A PAGAR no FIN (§2 do 02A / §2.2 do 05). Ação
 * EXPLÍCITA (POST): apura (reusando o motor, que valida o modelo do vendedor) e, se houver valor,
 * cria o título via `CommissionPayablePort`. Comissão zero → não gera título.
 *
 * A empresa que paga vem do comando (o operador escolhe) porque a apuração do Modelo A soma o
 * vendido do vendedor, que pode cruzar empresas — o título, porém, pertence a UMA (§2.6 do 05).
 */
@Injectable()
export class GenerateCommissionPayableUseCase implements UseCase<
  GenerateCommissionPayableCommand,
  CommissionModelAResultDto
> {
  constructor(
    private readonly compute: ComputeModelACommissionUseCase,
    @Inject(COMMISSION_PAYABLE) private readonly payable: CommissionPayablePort,
  ) {}

  async execute(command: GenerateCommissionPayableCommand): Promise<CommissionModelAResultDto> {
    const result = await this.compute.execute(
      new ComputeModelACommissionQuery(command.salesRepId, command.period),
    );

    if (result.commissionValue > 0) {
      result.payableTitleId = await this.payable.materialize({
        accountId: command.accountId,
        salesRepId: command.salesRepId,
        period: command.period,
        companyId: command.companyId,
        amount: result.commissionValue,
      });
    }

    return result;
  }
}
