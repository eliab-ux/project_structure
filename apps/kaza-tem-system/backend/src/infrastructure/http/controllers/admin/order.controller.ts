import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@infrastructure/security/guards/admin.guard';
import { GetOrderUseCase } from '@contexts/order/application/use-cases/get-order/get-order.use-case';
import { GetOrderQuery } from '@contexts/order/application/use-cases/get-order/get-order.query';
import { ListOrdersQuery } from '@contexts/order/application/use-cases/list-orders/list-orders.query';
import { ListOrdersUseCase } from '@contexts/order/application/use-cases/list-orders/list-orders.use-case';
import { UpdateOrderStatusCommand } from '@contexts/order/application/use-cases/update-order-status/update-order-status.command';
import { UpdateOrderStatusUseCase } from '@contexts/order/application/use-cases/update-order-status/update-order-status.use-case';
import { RefundOrderCommand } from '@contexts/order/application/use-cases/refund-order/refund-order.command';
import { RefundOrderUseCase } from '@contexts/order/application/use-cases/refund-order/refund-order.use-case';
import { OrderResponseDto } from '../order/dto/order.response.dto';
import { UpdateOrderStatusRequestDto } from '../order/dto/update-order-status.request.dto';
import { RefundOrderRequestDto } from '../order/dto/refund-order.request.dto';

const parseNumberParam = (value?: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

@Controller('admin/orders')
@UseGuards(AdminGuard)
export class AdminOrderController {
  constructor(
    private readonly listOrdersUseCase: ListOrdersUseCase,
    private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly refundOrderUseCase: RefundOrderUseCase,
  ) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<OrderResponseDto[]> {
    const query = new ListOrdersQuery(status, parseNumberParam(limit), parseNumberParam(offset));
    const orders = await this.listOrdersUseCase.execute(query);
    return orders.map(OrderResponseDto.from);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusRequestDto,
  ): Promise<OrderResponseDto> {
    await this.updateOrderStatusUseCase.execute(
      new UpdateOrderStatusCommand(
        id,
        dto.status,
        dto.trackingCode,
        dto.paymentId,
        dto.paymentMethod,
      ),
    );
    const order = await this.getOrderUseCase.execute(new GetOrderQuery(id));
    return OrderResponseDto.from(order);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundOrderRequestDto,
  ): Promise<OrderResponseDto> {
    await this.refundOrderUseCase.execute(new RefundOrderCommand(id, dto.amount, dto.reason));
    const order = await this.getOrderUseCase.execute(new GetOrderQuery(id));
    return OrderResponseDto.from(order);
  }
}
