import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  SetCommissionTiersCommand,
  SetCommissionTiersUseCase,
} from '../../../../contexts/commission/application/use-cases/set-commission-tiers/set-commission-tiers.use-case';
import { GetCommissionTiersUseCase } from '../../../../contexts/commission/application/use-cases/get-commission-tiers/get-commission-tiers.use-case';
import {
  SetSalesTargetCommand,
  SetSalesTargetUseCase,
} from '../../../../contexts/commission/application/use-cases/set-sales-target/set-sales-target.use-case';
import {
  ListSalesTargetsQuery,
  ListSalesTargetsUseCase,
} from '../../../../contexts/commission/application/use-cases/list-sales-targets/list-sales-targets.use-case';
import {
  ComputeModelACommissionQuery,
  ComputeModelACommissionUseCase,
} from '../../../../contexts/commission/application/use-cases/compute-model-a/compute-model-a.use-case';
import {
  CommissionModelAResultDto,
  CommissionTierDto,
  SalesTargetDto,
} from '../../../../contexts/commission/application/dto/commission.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ComputeCommissionQueryDto,
  PeriodQueryDto,
  SetCommissionTiersRequestDto,
  SetSalesTargetRequestDto,
} from './dto/commission-request.dto';

/**
 * Comissão — Modelo A (§2 do 02A). `@RequireModule(VND)`. Configurar faixas e metas é `manage`
 * (configuração comercial); ler faixas/metas e APURAR é `read`. A apuração é prévia até o
 * faturamento existir (ver o lookup de "vendido").
 */
@Controller('commission')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.VND)
export class CommissionController {
  constructor(
    private readonly setTiers: SetCommissionTiersUseCase,
    private readonly getTiers: GetCommissionTiersUseCase,
    private readonly setTarget: SetSalesTargetUseCase,
    private readonly listTargets: ListSalesTargetsUseCase,
    private readonly computeModelA: ComputeModelACommissionUseCase,
  ) {}

  @Get('tiers')
  @RequirePermission(PERMISSIONS.sales.settingsRead)
  async tiers(): Promise<CommissionTierDto[]> {
    return this.getTiers.execute();
  }

  @Put('tiers')
  @RequirePermission(PERMISSIONS.sales.settingsManage)
  async replaceTiers(
    @Body() dto: SetCommissionTiersRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<CommissionTierDto[]> {
    return this.setTiers.execute(new SetCommissionTiersCommand(actor.accountId, dto.tiers));
  }

  @Get('targets')
  @RequirePermission(PERMISSIONS.sales.settingsRead)
  async targets(@Query() query: PeriodQueryDto): Promise<SalesTargetDto[]> {
    return this.listTargets.execute(new ListSalesTargetsQuery(query.period));
  }

  @Post('targets')
  @RequirePermission(PERMISSIONS.sales.settingsManage)
  async setSalesTarget(
    @Body() dto: SetSalesTargetRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<SalesTargetDto> {
    return this.setTarget.execute(
      new SetSalesTargetCommand(actor.accountId, dto.userId, dto.period, dto.targetValue),
    );
  }

  @Get('model-a')
  @RequirePermission(PERMISSIONS.sales.settingsRead)
  async apurarModelA(
    @Query() query: ComputeCommissionQueryDto,
  ): Promise<CommissionModelAResultDto> {
    return this.computeModelA.execute(
      new ComputeModelACommissionQuery(query.salesRepId, query.period),
    );
  }
}
