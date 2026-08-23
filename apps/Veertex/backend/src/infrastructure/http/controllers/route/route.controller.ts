import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateRouteCommand,
  CreateRouteUseCase,
} from '../../../../contexts/route/application/use-cases/create-route/create-route.use-case';
import {
  ListRoutesQuery,
  ListRoutesUseCase,
} from '../../../../contexts/route/application/use-cases/list-routes/list-routes.use-case';
import {
  UpdateRouteCommand,
  UpdateRouteUseCase,
} from '../../../../contexts/route/application/use-cases/update-route/update-route.use-case';
import {
  GetCommercialRuleQuery,
  GetCommercialRuleUseCase,
} from '../../../../contexts/route/application/use-cases/get-commercial-rule/get-commercial-rule.use-case';
import {
  SetCommercialRuleCommand,
  SetCommercialRuleUseCase,
} from '../../../../contexts/route/application/use-cases/set-commercial-rule/set-commercial-rule.use-case';
import { CommercialRuleDto, RouteDto } from '../../../../contexts/route/application/dto/route.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreateRouteRequestDto,
  ListRoutesQueryDto,
  SetCommercialRuleRequestDto,
  UpdateRouteRequestDto,
} from './dto/route-request.dto';

/**
 * Rotas + Regra Comercial — ROT (§04), fatia 2. `@RequireModule(ROT)` no controller; `rot.read` para
 * ver, `rot.settings` para o cadastro (rotas e Regra Comercial do representante).
 */
@Controller('routes')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.ROT)
export class RouteController {
  constructor(
    private readonly createRoute: CreateRouteUseCase,
    private readonly listRoutes: ListRoutesUseCase,
    private readonly updateRoute: UpdateRouteUseCase,
    private readonly getCommercialRule: GetCommercialRuleUseCase,
    private readonly setCommercialRule: SetCommercialRuleUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.rot.read)
  async list(@Query() query: ListRoutesQueryDto): Promise<RouteDto[]> {
    return this.listRoutes.execute(new ListRoutesQuery(query.includeInactive ?? false));
  }

  @Post()
  @RequirePermission(PERMISSIONS.rot.settings)
  async create(
    @Body() dto: CreateRouteRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<RouteDto> {
    return this.createRoute.execute(
      new CreateRouteCommand(actor.accountId, dto.name, dto.code ?? null),
    );
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.rot.settings)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRouteRequestDto,
  ): Promise<RouteDto> {
    return this.updateRoute.execute(
      new UpdateRouteCommand(id, { name: dto.name, code: dto.code, active: dto.active }),
    );
  }

  @Get('commercial-rules/:userId')
  @RequirePermission(PERMISSIONS.rot.settings)
  async commercialRule(@Param('userId', ParseUUIDPipe) userId: string): Promise<CommercialRuleDto> {
    return this.getCommercialRule.execute(new GetCommercialRuleQuery(userId));
  }

  @Put('commercial-rules/:userId')
  @RequirePermission(PERMISSIONS.rot.settings)
  async setRule(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetCommercialRuleRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<CommercialRuleDto> {
    return this.setCommercialRule.execute(
      new SetCommercialRuleCommand(actor.accountId, userId, {
        allowedCompanyIds: dto.allowedCompanyIds,
        allowedPaymentConditionIds: dto.allowedPaymentConditionIds,
        allowedPriceListIds: dto.allowedPriceListIds,
        allowedOperationNatures: dto.allowedOperationNatures,
      }),
    );
  }
}
