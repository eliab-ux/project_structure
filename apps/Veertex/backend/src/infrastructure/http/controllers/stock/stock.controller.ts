import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
  StockBalanceDto,
  StockMovementDto,
} from '../../../../contexts/stock/application/dto/stock.dto';
import { StockMovementType } from '../../../../contexts/stock/domain/movement-type';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  ListMovementsQueryDto,
  RegisterMovementRequestDto,
  StockBalanceQueryDto,
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
  ) {}

  @Get('balance')
  @RequirePermission(PERMISSIONS.stock.read)
  async balance(@Query() query: StockBalanceQueryDto): Promise<StockBalanceDto> {
    return this.getStockBalanceUseCase.execute(
      new GetStockBalanceQuery(query.companyId, query.productId),
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
        dto.type as StockMovementType,
        dto.quantity,
        dto.unitCost ?? null,
        dto.relatedMovementId ?? null,
        dto.note ?? null,
        dto.occurredAt ? new Date(dto.occurredAt) : null,
      ),
    );
  }
}
