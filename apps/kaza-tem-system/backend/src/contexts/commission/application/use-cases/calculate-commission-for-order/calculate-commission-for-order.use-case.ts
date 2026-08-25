import { Injectable, Inject } from '@nestjs/common';
import { CalculateCommissionCommand } from './calculate-commission.command';
import { UseCase } from '@gitspread/shared-kernel';
import {
  COMMISSION_REPOSITORY,
  COMMISSION_RULE_REPOSITORY,
  CommissionRepositoryPort,
  CommissionRuleRepositoryPort,
} from '../../ports/output/commission-repository.port';
import { Percentage } from '../../../domain/value-objects/percentage.vo';
import { CommissionDto } from '../../dto/commission.dto';
import { Commission } from '../../../domain/entities/commission.entity';

@Injectable()
export class CalculateCommissionForOrderUseCase implements UseCase<
  CalculateCommissionCommand,
  CommissionDto
> {
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
    @Inject(COMMISSION_RULE_REPOSITORY)
    private readonly ruleRepository: CommissionRuleRepositoryPort,
  ) {}

  async execute(command: CalculateCommissionCommand): Promise<CommissionDto> {
    const rules = await this.ruleRepository.findActive();
    const monthlySales = await this.commissionRepository.getResellerMonthlySales(
      command.resellerId,
    );
    const applicable = rules.find((rule) => rule.matches(monthlySales + command.orderTotal));

    if (!applicable) {
      throw new Error('Nenhuma faixa de comissão encontrada');
    }

    const commission = Commission.calculate({
      resellerId: command.resellerId,
      orderId: command.orderId,
      orderTotal: command.orderTotal,
      shippingCost: command.shippingCost,
      discount: command.discount ?? 0,
      percentage: Percentage.from(applicable.percentage),
    });

    const saved = await this.commissionRepository.save(commission);
    return CommissionDto.fromDomain(saved);
  }
}
