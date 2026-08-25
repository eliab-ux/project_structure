import { forwardRef, Module } from '@nestjs/common';
import { HttpModule as NestHttpModule } from '@nestjs/axios';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrderItemOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/order-item-orm.entity';
import { OrderOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/order-orm.entity';
import { MarketplaceApiKeyOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/marketplace-api-key-orm.entity';
import { ORDER_REPOSITORY } from './application/ports/output/order-repository.port';
import { MikroOrmOrderRepository } from '../../infrastructure/persistence/mikro-orm/repositories/order.repository';
import { OrderMapper } from '../../infrastructure/persistence/mikro-orm/mappers/order.mapper';
import { CreateOrderUseCase } from './application/use-cases/create-order/create-order.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order/get-order.use-case';
import { ListUserOrdersUseCase } from './application/use-cases/list-user-orders/list-user-orders.use-case';
import { ListOrdersUseCase } from './application/use-cases/list-orders/list-orders.use-case';
import { CancelOrderUseCase } from './application/use-cases/cancel-order/cancel-order.use-case';
import { UpdateOrderStatusUseCase } from './application/use-cases/update-order-status/update-order-status.use-case';
import { ProcessPaymentUseCase } from './application/use-cases/process-payment/process-payment.use-case';
import { ProcessPaymentWebhookUseCase } from './application/use-cases/process-payment-webhook/process-payment-webhook.use-case';
import { RefundOrderUseCase } from './application/use-cases/refund-order/refund-order.use-case';
import { CieloModule } from '@infrastructure/integrations/cielo/cielo.module';
import { UserModule } from '../user/user.module';
import { SendOrderWebhookHandler } from '@infrastructure/messaging/handlers/send-order-webhook.handler';

@Module({
  imports: [
    MikroOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity, MarketplaceApiKeyOrmEntity]),
    forwardRef(() => CieloModule),
    NestHttpModule,
    UserModule,
  ],
  providers: [
    OrderMapper,
    {
      provide: ORDER_REPOSITORY,
      useClass: MikroOrmOrderRepository,
    },
    CreateOrderUseCase,
    GetOrderUseCase,
    ListUserOrdersUseCase,
    ListOrdersUseCase,
    CancelOrderUseCase,
    UpdateOrderStatusUseCase,
    ProcessPaymentUseCase,
    ProcessPaymentWebhookUseCase,
    RefundOrderUseCase,
    SendOrderWebhookHandler,
  ],
  exports: [
    CreateOrderUseCase,
    GetOrderUseCase,
    ListUserOrdersUseCase,
    ListOrdersUseCase,
    CancelOrderUseCase,
    RefundOrderUseCase,
    UpdateOrderStatusUseCase,
    ProcessPaymentUseCase,
    ProcessPaymentWebhookUseCase,
    ORDER_REPOSITORY,
  ],
})
export class OrderModule {}
