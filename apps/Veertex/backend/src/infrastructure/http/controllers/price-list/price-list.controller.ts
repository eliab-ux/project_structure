import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreatePriceListCommand,
  CreatePriceListUseCase,
} from '../../../../contexts/price-list/application/use-cases/create-price-list/create-price-list.use-case';
import {
  UpdatePriceListCommand,
  UpdatePriceListUseCase,
} from '../../../../contexts/price-list/application/use-cases/update-price-list/update-price-list.use-case';
import {
  ListPriceListsQuery,
  ListPriceListsUseCase,
} from '../../../../contexts/price-list/application/use-cases/list-price-lists/list-price-lists.use-case';
import {
  ResolvePriceQuery,
  ResolvePriceUseCase,
} from '../../../../contexts/price-list/application/use-cases/resolve-price/resolve-price.use-case';
import {
  PriceListDto,
  ResolvedPriceDto,
} from '../../../../contexts/price-list/application/dto/price-list.dto';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  CreatePriceListRequestDto,
  ListPriceListsQueryDto,
  ResolvePriceQueryDto,
  UpdatePriceListRequestDto,
} from './dto/price-list-request.dto';

/**
 * Tabelas de preço — configuração comercial do VND (§3.2 do 02A).
 *
 * `@RequireModule(VND)` no controller. CRUD guardado por `sales.settings.*` (configurar comércio);
 * a RESOLUÇÃO (`/resolve`) por `orders.read` — quem monta pedido precisa consultar o preço, mas
 * consultar preço não é configurar tabela.
 */
@Controller('price-lists')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.VND)
export class PriceListController {
  constructor(
    private readonly createUseCase: CreatePriceListUseCase,
    private readonly updateUseCase: UpdatePriceListUseCase,
    private readonly listUseCase: ListPriceListsUseCase,
    private readonly resolveUseCase: ResolvePriceUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.sales.settingsRead)
  async list(@Query() query: ListPriceListsQueryDto): Promise<PriceListDto[]> {
    return this.listUseCase.execute(new ListPriceListsQuery(query.includeInactive ?? false));
  }

  @Get('resolve')
  @RequirePermission(PERMISSIONS.orders.read)
  async resolve(@Query() query: ResolvePriceQueryDto): Promise<ResolvedPriceDto> {
    return this.resolveUseCase.execute(
      new ResolvePriceQuery(
        query.productId,
        query.quantity,
        query.contactId ?? null,
        query.salesRepId ?? null,
      ),
    );
  }

  @Post()
  @RequirePermission(PERMISSIONS.sales.settingsManage)
  async create(
    @Body() dto: CreatePriceListRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<PriceListDto> {
    return this.createUseCase.execute(
      new CreatePriceListCommand(actor.accountId, {
        name: dto.name,
        contactId: dto.contactId ?? null,
        salesRepId: dto.salesRepId ?? null,
        items: dto.items,
      }),
    );
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.sales.settingsManage)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceListRequestDto,
  ): Promise<PriceListDto> {
    return this.updateUseCase.execute(
      new UpdatePriceListCommand(id, {
        name: dto.name,
        active: dto.active,
        contactId: dto.contactId,
        salesRepId: dto.salesRepId,
        items: dto.items,
      }),
    );
  }
}
