import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  COMMERCIAL_RULE_REPOSITORY,
  CommercialRuleRepositoryPort,
} from '../../ports/output/commercial-rule-repository.port';
import { CommercialRule } from '../../../domain/entities/commercial-rule.entity';
import { CommercialRuleDto } from '../../dto/route.dto';

export class GetCommercialRuleQuery {
  constructor(public readonly userId: string) {}
}

/**
 * Regra Comercial de um representante (§3.7 do 04). Sem regra cadastrada → perfil VAZIO (sem
 * restrição em nenhuma dimensão) — o default é "pode tudo", e a conta restringe por opt-in.
 */
@Injectable()
export class GetCommercialRuleUseCase implements UseCase<
  GetCommercialRuleQuery,
  CommercialRuleDto
> {
  constructor(
    @Inject(COMMERCIAL_RULE_REPOSITORY) private readonly rules: CommercialRuleRepositoryPort,
  ) {}

  async execute(query: GetCommercialRuleQuery): Promise<CommercialRuleDto> {
    const rule =
      (await this.rules.findByUser(query.userId)) ??
      CommercialRule.create({ accountId: '', userId: query.userId });
    return CommercialRuleDto.fromDomain(rule);
  }
}
