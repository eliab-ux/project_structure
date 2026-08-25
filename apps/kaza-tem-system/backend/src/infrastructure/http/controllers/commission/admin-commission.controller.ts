import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommissionDto } from '../../../../contexts/commission/application/dto/commission.dto';
import {
  CommissionRuleDto,
  CommissionRuleInputDto,
} from '../../../../contexts/commission/application/dto/commission-rule.dto';
import {
  CommissionRepositoryPort,
  CommissionRuleRepositoryPort,
  COMMISSION_REPOSITORY,
  COMMISSION_RULE_REPOSITORY,
} from '../../../../contexts/commission/application/ports/output/commission-repository.port';
import { ConfigureCommissionRulesCommand } from '../../../../contexts/commission/application/use-cases/configure-commission-rules/configure-commission-rules.command';
import { ConfigureCommissionRulesUseCase } from '../../../../contexts/commission/application/use-cases/configure-commission-rules/configure-commission-rules.use-case';
import { GetCommissionHistoryQuery } from '../../../../contexts/commission/application/use-cases/get-commission-history/get-commission-history.query';
import { GetCommissionHistoryUseCase } from '../../../../contexts/commission/application/use-cases/get-commission-history/get-commission-history.use-case';
import { AdminGuard } from '@infrastructure/security/guards/admin.guard';

@Controller('admin/commissions')
@UseGuards(AdminGuard)
export class AdminCommissionController {
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly repository: CommissionRepositoryPort,
    private readonly configureRules: ConfigureCommissionRulesUseCase,
    private readonly getHistory: GetCommissionHistoryUseCase,
    @Inject(COMMISSION_RULE_REPOSITORY)
    private readonly ruleRepository: CommissionRuleRepositoryPort,
  ) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<CommissionDto[]> {
    const commissions = await this.repository.findAll({
      status: status ? status.split(',') : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return commissions.map(CommissionDto.fromDomain);
  }

  @Get('rules')
  async rules(): Promise<CommissionRuleDto[]> {
    const rules = await this.ruleRepository.findAll();
    return rules.map(CommissionRuleDto.fromDomain);
  }

  @Put('rules')
  async configure(@Body() dto: CommissionRuleInputDto[]): Promise<CommissionRuleDto[]> {
    if (!Array.isArray(dto) || dto.length === 0) {
      throw new BadRequestException('Ao menos uma regra deve ser fornecida');
    }
    return this.configureRules.execute(new ConfigureCommissionRulesCommand(dto));
  }

  @Get('history')
  async history(@Query('resellerId') resellerId: string): Promise<CommissionDto[]> {
    if (!resellerId) {
      throw new BadRequestException('resellerId é obrigatório');
    }
    return this.getHistory.execute(new GetCommissionHistoryQuery(resellerId));
  }
}
