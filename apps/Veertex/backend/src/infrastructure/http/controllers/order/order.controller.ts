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
  CreateOrderCommand,
  CreateOrderUseCase,
} from '../../../../contexts/order/application/use-cases/create-order/create-order.use-case';
import {
  UpdateOrderCommand,
  UpdateOrderUseCase,
} from '../../../../contexts/order/application/use-cases/update-order/update-order.use-case';
import {
  ChangeOrderStatusCommand,
  ChangeOrderStatusUseCase,
} from '../../../../contexts/order/application/use-cases/change-order-status/change-order-status.use-case';
import {
  GetOrderQuery,
  GetOrderUseCase,
} from '../../../../contexts/order/application/use-cases/get-order/get-order.use-case';
import {
  ListOrdersQuery,
  ListOrdersUseCase,
} from '../../../../contexts/order/application/use-cases/list-orders/list-orders.use-case';
import { OrderDto } from '../../../../contexts/order/application/dto/order.dto';
import { DeliveryMode, OrderOrigin } from '../../../../contexts/order/domain/order-origin';
import { AuthTokenPayload } from '../../../../contexts/auth/application/ports/output/token-service.port';
import { MODULES } from '../../../../contexts/module/domain/modules.catalog';
import { grants, PERMISSIONS } from '../../../../contexts/role/domain/permissions.catalog';
import { ModuleGuard } from '../../../security/guards/module.guard';
import { PermissionGuard } from '../../../security/guards/permission.guard';
import { RequireModule } from '../../../security/decorators/require-module.decorator';
import { RequirePermission } from '../../../security/decorators/require-permission.decorator';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import {
  OpenConsignedOrderCommand,
  OpenConsignedOrderUseCase,
} from '../../../../contexts/route/application/use-cases/open-consigned-order/open-consigned-order.use-case';
import {
  CloseConsignedOrderCommand,
  CloseConsignedOrderUseCase,
} from '../../../../contexts/route/application/use-cases/close-consigned-order/close-consigned-order.use-case';
import { CloseConsignmentRequestDto } from './dto/order-request.dto';
import {
  CreateOrderRequestDto,
  ListOrdersQueryDto,
  UpdateOrderRequestDto,
} from './dto/order-request.dto';

/**
 * Pedidos — VND (§02).
 *
 * `@RequireModule(VND)` no controller (módulo primeiro: "módulo inativo" é mais acionável que
 * "sem permissão"); a permissão por operação, no método. Desconto tem sub-permissão própria
 * (`orders.discount.grant`), lida do TOKEN e passada aos use cases — nunca de um campo do corpo.
 */
@Controller('orders')
@UseGuards(ModuleGuard, PermissionGuard)
@RequireModule(MODULES.VND)
export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly updateOrderUseCase: UpdateOrderUseCase,
    private readonly changeOrderStatusUseCase: ChangeOrderStatusUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly listOrdersUseCase: ListOrdersUseCase,
    private readonly openConsignedOrderUseCase: OpenConsignedOrderUseCase,
    private readonly closeConsignedOrderUseCase: CloseConsignedOrderUseCase,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.orders.read)
  async list(@Query() query: ListOrdersQueryDto): Promise<OrderDto[]> {
    return this.listOrdersUseCase.execute(
      new ListOrdersQuery({
        status: query.status ?? null,
        companyId: query.companyId ?? null,
        contactId: query.contactId ?? null,
        salesRepId: query.salesRepId ?? null,
        referenceFrom: query.from ? new Date(query.from) : null,
        referenceTo: query.to ? new Date(query.to) : null,
        search: query.search ?? null,
      }),
    );
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.orders.read)
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<OrderDto> {
    return this.getOrderUseCase.execute(new GetOrderQuery(id));
  }

  @Post()
  @RequirePermission(PERMISSIONS.orders.create)
  async create(
    @Body() dto: CreateOrderRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderDto> {
    return this.createOrderUseCase.execute(
      new CreateOrderCommand(actor.accountId, actor.sub, this.canDiscount(actor), {
        companyId: dto.companyId,
        contactId: dto.contactId,
        salesRepId: dto.salesRepId ?? null,
        origin: dto.origin as OrderOrigin,
        deliveryMode: (dto.deliveryMode as DeliveryMode | undefined) ?? null,
        originDetail: dto.originDetail ?? null,
        tripId: dto.tripId ?? null,
        paymentConditionId: dto.paymentConditionId ?? null,
        items: dto.items,
        discountPercent: dto.discountPercent ?? null,
        discountValue: dto.discountValue ?? null,
        notes: dto.notes ?? null,
        referenceDate: dto.referenceDate ? new Date(dto.referenceDate) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      }),
    );
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.orders.update)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderDto> {
    return this.updateOrderUseCase.execute(
      new UpdateOrderCommand(id, this.canDiscount(actor), {
        origin: dto.origin as OrderOrigin | undefined,
        deliveryMode: dto.deliveryMode as DeliveryMode | undefined,
        originDetail: dto.originDetail,
        salesRepId: dto.salesRepId,
        paymentConditionId: dto.paymentConditionId,
        items: dto.items,
        discountPercent: dto.discountPercent,
        discountValue: dto.discountValue,
        notes: dto.notes,
        referenceDate: dto.referenceDate ? new Date(dto.referenceDate) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      }),
    );
  }

  @Post(':id/quote')
  @RequirePermission(PERMISSIONS.orders.update)
  async quote(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderDto> {
    // Emite o orçamento (§3.3 do 02A). Não reserva estoque nem checa crédito — é proposta.
    return this.changeOrderStatusUseCase.execute(
      new ChangeOrderStatusCommand(id, 'quote', actor.modules ?? []),
    );
  }

  @Post(':id/confirm')
  @RequirePermission(PERMISSIONS.orders.update)
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderDto> {
    // `modules` do TOKEN — decide se a confirmação reserva estoque (§3.9). Só com EST ativo.
    return this.changeOrderStatusUseCase.execute(
      new ChangeOrderStatusCommand(id, 'confirm', actor.modules ?? []),
    );
  }

  @Post(':id/complete')
  @RequirePermission(PERMISSIONS.orders.update)
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderDto> {
    return this.changeOrderStatusUseCase.execute(
      new ChangeOrderStatusCommand(id, 'complete', actor.modules ?? []),
    );
  }

  /**
   * rascunho → consignado_aberto (§3.1/§3.3 do 04): EFETIVA a proposta consignada do campo. Exige
   * `rot.trip.manage` — é operação da retaguarda da rota, não de quem só opera pedido.
   */
  @Post(':id/open-consignment')
  @RequirePermission(PERMISSIONS.rot.trip)
  async openConsignment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderDto> {
    // Efetivação + nascimento do TÍTULO da consignação (vencimento = saída + cycle_days da rota).
    return this.openConsignedOrderUseCase.execute(
      new OpenConsignedOrderCommand(actor.accountId, id),
    );
  }

  /** consignado_aberto → em_acerto (a passagem seguinte chegou; §3.2 do 04). */
  @Post(':id/start-settlement')
  @RequirePermission(PERMISSIONS.rot.trip)
  async startSettlement(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderDto> {
    return this.changeOrderStatusUseCase.execute(
      new ChangeOrderStatusCommand(id, 'start_settlement', actor.modules ?? []),
    );
  }

  /** em_acerto → fechado (o acerto efetivado — a venda consignada se conclui). */
  @Post(':id/close-consignment')
  @RequirePermission(PERMISSIONS.rot.trip)
  async closeConsignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseConsignmentRequestDto,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderDto> {
    // Venda do consignado = saída física da carga (sale_out @rep_load) + emitConsignedSale, no
    // mesmo evento (semântica confirmada). soldLines ausente → itens do pedido inteiros.
    return this.closeConsignedOrderUseCase.execute(
      new CloseConsignedOrderCommand(actor.accountId, id, dto.soldLines ?? null),
    );
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.orders.cancel)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthTokenPayload,
  ): Promise<OrderDto> {
    return this.changeOrderStatusUseCase.execute(
      new ChangeOrderStatusCommand(id, 'cancel', actor.modules ?? []),
    );
  }

  /** Lê a sub-permissão de desconto do token. `grants` resolve wildcard segmento a segmento. */
  private canDiscount(actor: AuthTokenPayload): boolean {
    return grants(actor.permissions ?? [], PERMISSIONS.orders.discountGrant);
  }
}
