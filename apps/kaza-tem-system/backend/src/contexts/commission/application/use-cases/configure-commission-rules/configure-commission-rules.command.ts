import { CommissionRuleInputDto } from '../../dto/commission-rule.dto';

export class ConfigureCommissionRulesCommand {
  constructor(public readonly rules: CommissionRuleInputDto[]) {}
}
