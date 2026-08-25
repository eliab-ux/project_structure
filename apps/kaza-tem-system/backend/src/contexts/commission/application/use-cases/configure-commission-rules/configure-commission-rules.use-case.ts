import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { randomUUID } from 'crypto';
import { CommissionRule } from '../../../domain/entities/commission-rule.entity';
import {
  COMMISSION_RULE_REPOSITORY,
  CommissionRuleRepositoryPort,
} from '../../ports/output/commission-repository.port';
import { ConfigureCommissionRulesCommand } from './configure-commission-rules.command';
import { CommissionRuleDto } from '../../dto/commission-rule.dto';

@Injectable()
export class ConfigureCommissionRulesUseCase implements UseCase<
  ConfigureCommissionRulesCommand,
  CommissionRuleDto[]
> {
  constructor(
    @Inject(COMMISSION_RULE_REPOSITORY)
    private readonly ruleRepository: CommissionRuleRepositoryPort,
  ) {}

  async execute(command: ConfigureCommissionRulesCommand): Promise<CommissionRuleDto[]> {
    const domainRules = command.rules.map((rule) => {
      const id = rule.id && rule.id.trim().length > 0 ? rule.id : randomUUID();
      return new CommissionRule(
        id,
        rule.minAmount,
        rule.maxAmount ?? null,
        rule.percentage,
        rule.isActive,
      );
    });

    await this.ruleRepository.syncRules(domainRules);
    return domainRules.map(CommissionRuleDto.fromDomain);
  }
}
