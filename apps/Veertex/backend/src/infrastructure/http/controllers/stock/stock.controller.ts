import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import {
  RegisterMovementCommand,
  RegisterMovementUseCase,
} from '../../../../contexts/stock/application/use-cases/register-movement/register-movement.use-case';
import {
  GetStockBalanceQuery,
  GetStockBalanceUseCase,
} from '../../../../contexts/stock/application/use-cases/get-stock-balance/get-stock-balance.use-case';
import {
  ListMovementsQuery,
  ListMovementsUseCase,
} from '../../../../contexts/stock/application/use-cases/list-movements/list-movements.use-case';
import {
  TransferStockCommand,
  TransferStockResult,
  TransferStockUseCase,
} from '../../../../contexts/stock/application/use-cases/transfer-stock/transfer-stock.use-case';
import {
  CreateStockLocationCommand,
  CreateStockLocationUseCase,
} from '../../../../contexts/stock/application/use-cases/create-stock-location/create-stock-location.use-case';
import {
  ListStockLocationsQuery,
  ListStockLocationsUseCase,
} from '../../../../contexts/stock/application/use-cases/list-stock-locations/list-stock-locations.use-case';
import {
  StockBalanceDto,
  StockLocationDto,
  StockMovementDto,
} from '../../../../contexts/stock/application/dto/stock.dto';
import { StockMovementType } from '../../../../contexts/stock/domain/movement-type';
import { StockLocationKind } from '../../../../contexts/stock/domain/entities/stock-location.entity';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreateStockLocationRequestDto,
  ListMovementsQueryDto,
  ListStockLocationsQueryDto,
  RegisterMovementRequestDto,
  StockBalanceQueryDto,
  TransferStockRequestDto,
} from './dto/stock-request.dto';

/**
 * Estoque — EST (§03). `@RequireModule(EST)` no controller; permissão por operação no método.
 * Saldo e custo são DERIVADOS (§3.1); o registro de movimento é append-only (§2.7).
 */
@Controller('stock')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.EST)
export class StockController {
  constructor(
    private readonly registerMovementUseCase: RegisterMovementUseCase,
    private readonly getStockBalanceUseCase: GetStockBalanceUseCase,
    private readonly listMovementsUseCase: ListMovementsUseCase,
    private readonly transferStockUseCase: TransferStockUseCase,
    private readonly createStockLocationUseCase: CreateStockLocationUseCase,
    private readonly listStockLocationsUseCase: ListStockLocationsUseCase,
  ) {}

  @Get('balance')
  @RequirePermission(PERMISSIONS.stock.read)
  async balance(@Query() query: StockBalanceQueryDto): Promise<StockBalanceDto> {
    return this.getStockBalanceUseCase.execute(
      new GetStockBalanceQuery(query.companyId, query.productId, query.locationId ?? null),
    );
  }

  @Get('locations')
  @RequirePermission(PERMISSIONS.stock.read)
  async locations(@Query() query: ListStockLocationsQueryDto): Promise<StockLocationDto[]> {
    return this.listStockLocationsUseCase.execute(new ListStockLocationsQuery(query.companyId));
  }

  @Post('locations')
  @HttpCode(201)
  @RequirePermission(PERMISSIONS.stock.move)
  async createLocation(
    @Body() dto: CreateStockLocationRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<StockLocationDto> {
    return this.createStockLocationUseCase.execute(
      new CreateStockLocationCommand(
        actor.accountId,
        dto.companyId,
        dto.kind as StockLocationKind,
        dto.name,
      ),
    );
  }

  @Get('movements')
  @RequirePermission(PERMISSIONS.stock.read)
  async movements(@Query() query: ListMovementsQueryDto): Promise<StockMovementDto[]> {
    return this.listMovementsUseCase.execute(
      new ListMovementsQuery({
        companyId: query.companyId ?? null,
        productId: query.productId ?? null,
        type: query.type ?? null,
      }),
    );
  }

  @Post('movements')
  @RequirePermission(PERMISSIONS.stock.move)
  async register(
    @Body() dto: RegisterMovementRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<StockMovementDto> {
    return this.registerMovementUseCase.execute(
      new RegisterMovementCommand(
        actor.accountId,
        dto.companyId,
        dto.productId,
        dto.locationId,
        dto.type as StockMovementType,
        dto.quantity,
        dto.unitCost ?? null,
        dto.relatedMovementId ?? null,
        dto.note ?? null,
        dto.occurredAt ? new Date(dto.occurredAt) : null,
      ),
    );
  }

  @Post('transfers')
  @HttpCode(201)
  @RequirePermission(PERMISSIONS.stock.move)
  async transfer(
    @Body() dto: TransferStockRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<TransferStockResult> {
    return this.transferStockUseCase.execute(
      new TransferStockCommand(
        actor.accountId,
        dto.companyId,
        dto.productId,
        dto.fromLocationId,
        dto.toLocationId,
        dto.quantity,
        dto.note ?? null,
        dto.occurredAt ? new Date(dto.occurredAt) : null,
      ),
    );
  }
}
