import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  COMMERCIAL_RULE_REPOSITORY,
  CommercialRuleRepositoryPort,
} from '../../ports/output/commercial-rule-repository.port';
import { CommercialRule } from '../../../domain/entities/commercial-rule.entity';
import { CommercialRuleDto } from '../../dto/route.dto';

export class SetCommercialRuleCommand {
  constructor(
    public readonly accountId: string,
    public readonly userId: string,
    public readonly input: {
      allowedCompanyIds: string[];
      allowedPaymentConditionIds: string[];
      allowedPriceListIds: string[];
      allowedOperationNatures: string[];
    },
  ) {}
}

/**
 * Define a Regra Comercial do representante (§3.7 do 04) — SUBSTITUI o perfil. Upsert por `userId`:
 * uma regra por representante.
 */
@Injectable()
export class SetCommercialRuleUseCase implements UseCase<
  SetCommercialRuleCommand,
  CommercialRuleDto
> {
  constructor(
    @Inject(COMMERCIAL_RULE_REPOSITORY) private readonly rules: CommercialRuleRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SetCommercialRuleCommand): Promise<CommercialRuleDto> {
    return this.uow.execute(async () => {
      const existing = await this.rules.findByUser(command.userId);
      const rule =
        existing ?? CommercialRule.create({ accountId: command.accountId, userId: command.userId });
      rule.replace(command.input);
      const saved = await this.rules.save(rule);
      return CommercialRuleDto.fromDomain(saved);
    });
  }
}
