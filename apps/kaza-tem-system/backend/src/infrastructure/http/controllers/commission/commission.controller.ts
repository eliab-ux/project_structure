import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import { GetResellerBalanceUseCase } from '../../../../contexts/commission/application/use-cases/get-reseller-balance/get-reseller-balance.use-case';
import { GetCommissionHistoryUseCase } from '../../../../contexts/commission/application/use-cases/get-commission-history/get-commission-history.use-case';
import { CommissionDto } from '../../../../contexts/commission/application/dto/commission.dto';
import { CommissionRuleDto } from '../../../../contexts/commission/application/dto/commission-rule.dto';
import {
  CommissionRuleRepositoryPort,
  COMMISSION_RULE_REPOSITORY,
} from '../../../../contexts/commission/application/ports/output/commission-repository.port';
import { GetCommissionHistoryQuery } from '../../../../contexts/commission/application/use-cases/get-commission-history/get-commission-history.query';

@Controller('commissions')
export class CommissionController {
  constructor(
    private readonly getBalance: GetResellerBalanceUseCase,
    private readonly getHistory: GetCommissionHistoryUseCase,
    @Inject(COMMISSION_RULE_REPOSITORY)
    private readonly ruleRepository: CommissionRuleRepositoryPort,
  ) {}

  @Get('balance')
  async balance(@Query('resellerId') resellerId: string) {
    return this.getBalance.execute(resellerId);
  }

  @Get('history')
  async history(
    @Query('resellerId') resellerId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<CommissionDto[]> {
    if (!resellerId) {
      throw new BadRequestException('resellerId é obrigatório');
    }
    const query = new GetCommissionHistoryQuery(
      resellerId,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
    return this.getHistory.execute(query);
  }

  @Get('rules')
  async rules(): Promise<CommissionRuleDto[]> {
    const rules = await this.ruleRepository.findAll();
    return rules.map(CommissionRuleDto.fromDomain);
  }
}
