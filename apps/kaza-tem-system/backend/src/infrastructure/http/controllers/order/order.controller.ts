import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CreateOrderUseCase } from '../../../../contexts/order/application/use-cases/create-order/create-order.use-case';
import { CreateOrderCommand } from '../../../../contexts/order/application/use-cases/create-order/create-order.command';
import { GetOrderUseCase } from '../../../../contexts/order/application/use-cases/get-order/get-order.use-case';
import { GetOrderQuery } from '../../../../contexts/order/application/use-cases/get-order/get-order.query';
import {
  ListUserOrdersUseCase,
  ListUserOrdersQuery,
} from '../../../../contexts/order/application/use-cases/list-user-orders/list-user-orders.use-case';
import { CancelOrderUseCase } from '../../../../contexts/order/application/use-cases/cancel-order/cancel-order.use-case';
import { CancelOrderCommand } from '../../../../contexts/order/application/use-cases/cancel-order/cancel-order.command';
import { UpdateOrderStatusUseCase } from '../../../../contexts/order/application/use-cases/update-order-status/update-order-status.use-case';
import { UpdateOrderStatusCommand } from '../../../../contexts/order/application/use-cases/update-order-status/update-order-status.command';
import { ProcessPaymentUseCase } from '../../../../contexts/order/application/use-cases/process-payment/process-payment.use-case';
import { ProcessPaymentCommand } from '../../../../contexts/order/application/use-cases/process-payment/process-payment.command';
import { CieloPaymentRequestDto } from '@infrastructure/integrations/cielo/dto/cielo-payment.request.dto';
import { CieloPaymentResponseDto } from '@infrastructure/integrations/cielo/dto/cielo-payment.response.dto';
import { CreateOrderRequestDto } from './dto/create-order.request.dto';
import { CancelOrderRequestDto } from './dto/cancel-order.request.dto';
import { OrderResponseDto } from './dto/order.response.dto';
import { OrderTrackResponseDto } from './dto/order-track.response.dto';
import { UpdateOrderStatusRequestDto } from './dto/update-order-status.request.dto';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly listUserOrdersUseCase: ListUserOrdersUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase,
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateOrderRequestDto): Promise<OrderResponseDto> {
    const order = await this.createOrderUseCase.execute(new CreateOrderCommand(dto));
    return OrderResponseDto.from(order);
  }

  @Get()
  async list(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<OrderResponseDto[]> {
    if (!userId) {
      throw new BadRequestException('O userId é obrigatório');
    }
    const orders = await this.listUserOrdersUseCase.execute(
      new ListUserOrdersQuery(
        userId,
        limit ? Number(limit) : undefined,
        offset ? Number(offset) : undefined,
      ),
    );
    return orders.map(OrderResponseDto.from);
  }

  @Get(':id')
  async find(@Param('id') id: string): Promise<OrderResponseDto> {
    const order = await this.getOrderUseCase.execute(new GetOrderQuery(id));
    return OrderResponseDto.from(order);
  }

  @Put(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param('id') id: string, @Body() dto: CancelOrderRequestDto): Promise<void> {
    await this.cancelOrderUseCase.execute(new CancelOrderCommand(id, dto.reason));
  }

  @Put(':id/status')
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

  @Get(':id/track')
  async track(@Param('id') id: string): Promise<OrderTrackResponseDto> {
    const order = await this.getOrderUseCase.execute(new GetOrderQuery(id));
    return OrderTrackResponseDto.from({
      id: order.id.value,
      status: order.status.value,
      trackingCode: order.trackingCode?.value,
    });
  }

  @Post(':id/pay')
  async pay(
    @Param('id') id: string,
    @Body() dto: CieloPaymentRequestDto,
  ): Promise<CieloPaymentResponseDto> {
    const payment = await this.processPaymentUseCase.execute(
      new ProcessPaymentCommand(id, dto.installments, dto.card, dto.customer, dto.amount),
    );
    return payment;
  }
}
