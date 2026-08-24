import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  BillingConfigDto,
  GetBillingConfigUseCase,
  SetBillingConfigCommand,
  SetBillingConfigUseCase,
  TestBillingConnectionUseCase,
} from '../../../../contexts/billing/application/use-cases/billing-config/billing-config.use-cases';
import {
  ChargeDto,
  chargeToDto,
  EmitChargeCommand,
  EmitChargeUseCase,
} from '../../../../contexts/billing/application/use-cases/emit-charge/emit-charge.use-case';
import {
  ApproveDunningEventCommand,
  ApproveDunningEventUseCase,
  DunningRuleDto,
  DunningRunResult,
  GetDunningRuleUseCase,
  RunDunningCommand,
  RunDunningUseCase,
  SaveDunningRuleCommand,
  SaveDunningRuleUseCase,
} from '../../../../contexts/billing/application/use-cases/dunning/dunning.use-cases';
import {
  RenegotiateTitlesCommand,
  RenegotiateTitlesUseCase,
  RenegotiationResult,
} from '../../../../contexts/billing/application/use-cases/renegotiate-titles/renegotiate-titles.use-case';
import {
  CHARGE_REPOSITORY,
  ChargeRepositoryPort,
  DUNNING_EVENT_REPOSITORY,
  DunningEventRepositoryPort,
} from '../../../../contexts/billing/application/ports/output/billing-repositories.port';
import { Inject } from '@nestjs/common';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  EmitChargeRequestDto,
  ListChargesQueryDto,
  ListDunningEventsQueryDto,
  RenegotiateTitlesRequestDto,
  SaveDunningRuleRequestDto,
  SetBillingConfigRequestDto,
} from './dto/billing-request.dto';

/**
 * COB — Cobrança (06). `@RequireModule(COB)` (que depende do FIN no catálogo — aceite 1);
 * `cob.read` para ver, `cob.manage` para configurar/emitir/rodar régua/renegociar.
 */
@Controller('billing')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.COB)
export class BillingController {
  constructor(
    private readonly setConfig: SetBillingConfigUseCase,
    private readonly getConfig: GetBillingConfigUseCase,
    private readonly testConnection: TestBillingConnectionUseCase,
    private readonly emitCharge: EmitChargeUseCase,
    private readonly saveRule: SaveDunningRuleUseCase,
    private readonly getRule: GetDunningRuleUseCase,
    private readonly runDunning: RunDunningUseCase,
    private readonly approveEvent: ApproveDunningEventUseCase,
    private readonly renegotiate: RenegotiateTitlesUseCase,
    @Inject(CHARGE_REPOSITORY) private readonly charges: ChargeRepositoryPort,
    @Inject(DUNNING_EVENT_REPOSITORY) private readonly events: DunningEventRepositoryPort,
  ) {}

  @Get('config')
  @RequirePermission(PERMISSIONS.cob.read)
  async config(): Promise<BillingConfigDto | null> {
    return this.getConfig.execute();
  }

  @Put('config')
  @RequirePermission(PERMISSIONS.cob.manage)
  async saveConfig(
    @Body() dto: SetBillingConfigRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<BillingConfigDto> {
    return this.setConfig.execute(
      new SetBillingConfigCommand(actor.accountId, {
        provider: dto.provider,
        credentials: dto.credentials,
        agreementCode: dto.agreementCode ?? null,
        settlementAccountId: dto.settlementAccountId,
        companyId: dto.companyId ?? null,
      }),
    );
  }

  @Post('config/test')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.cob.manage)
  async test(): Promise<{ ok: boolean; message: string }> {
    return this.testConnection.execute();
  }

  @Get('charges')
  @RequirePermission(PERMISSIONS.cob.read)
  async listCharges(@Query() query: ListChargesQueryDto): Promise<ChargeDto[]> {
    const rows = await this.charges.list({
      titleId: query.titleId ?? null,
      status: query.status ?? null,
    });
    return rows.map(chargeToDto);
  }

  @Post('charges')
  @HttpCode(201)
  @RequirePermission(PERMISSIONS.cob.manage)
  async emit(
    @Body() dto: EmitChargeRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<ChargeDto> {
    return this.emitCharge.execute(
      new EmitChargeCommand(actor.accountId, dto.titleId, dto.kind),
    );
  }

  @Get('dunning/rule')
  @RequirePermission(PERMISSIONS.cob.read)
  async rule(): Promise<DunningRuleDto | null> {
    return this.getRule.execute();
  }

  @Put('dunning/rule')
  @RequirePermission(PERMISSIONS.cob.manage)
  async saveDunningRule(
    @Body() dto: SaveDunningRuleRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<DunningRuleDto> {
    return this.saveRule.execute(
      new SaveDunningRuleCommand(actor.accountId, actor.sub, {
        steps: dto.steps,
        maxRebillings: dto.maxRebillings ?? null,
      }),
    );
  }

  @Post('dunning/run')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.cob.manage)
  async run(@CurrentUser() actor: AuthTokenPayload): Promise<DunningRunResult> {
    // Sem agendador (BullMQ fora): o botão da retaguarda é o gatilho — o mesmo caminho que um
    // cron chamará quando existir.
    return this.runDunning.execute(new RunDunningCommand(actor.accountId));
  }

  @Get('dunning/events')
  @RequirePermission(PERMISSIONS.cob.read)
  async listEvents(@Query() query: ListDunningEventsQueryDto) {
    const rows = await this.events.list({ status: query.status ?? null });
    return rows.map((event) => ({
      id: event.id,
      titleId: event.titleId,
      offsetDays: event.offsetDays,
      channel: event.channel,
      renderedMessage: event.renderedMessage,
      status: event.status,
      sentAt: event.sentAt ? event.sentAt.toISOString() : null,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  @Post('dunning/events/:id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.cob.manage)
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    // A aprovação humana da proposta (06 aceite 4) — é aqui que a mensagem SAI.
    return this.approveEvent.execute(new ApproveDunningEventCommand(id));
  }

  @Post('renegotiations')
  @HttpCode(201)
  @RequirePermission(PERMISSIONS.cob.manage)
  async renegotiateTitles(
    @Body() dto: RenegotiateTitlesRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<RenegotiationResult> {
    return this.renegotiate.execute(
      new RenegotiateTitlesCommand(actor.accountId, {
        titleIds: dto.titleIds,
        installments: dto.installments.map((installment) => ({
          amount: installment.amount,
          dueDate: new Date(installment.dueDate),
        })),
        description: dto.description ?? null,
      }),
    );
  }
}
