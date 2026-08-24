import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { CONTACT_OVERDUE_LOOKUP } from './application/ports/output/contact-overdue-lookup.port';
import { MikroOrmContactOverdueLookup } from '../../infrastructure/persistence/mikro-orm/repositories/contact-overdue.lookup';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ContactOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-orm.entity';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { OrderCustomerLookup } from '../../infrastructure/persistence/mikro-orm/repositories/order-customer.lookup';
import { OrderProductLookup } from '../../infrastructure/persistence/mikro-orm/repositories/order-product.lookup';
import { StockModule } from '../stock/stock.module';
import { EstOrderStockReservation } from '../../infrastructure/persistence/mikro-orm/repositories/est-order-stock-reservation.adapter';
import { CUSTOMER_LOOKUP } from './application/ports/output/customer-lookup.port';
import { ORDER_PRODUCT_LOOKUP } from './application/ports/output/order-product-lookup.port';
import { ORDER_STOCK_RESERVATION } from './application/ports/output/order-stock-reservation.port';
import { CreateOrderUseCase } from './application/use-cases/create-order/create-order.use-case';
import { UpdateOrderUseCase } from './application/use-cases/update-order/update-order.use-case';
import { ChangeOrderStatusUseCase } from './application/use-cases/change-order-status/change-order-status.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order/get-order.use-case';
import { ListOrdersUseCase } from './application/use-cases/list-orders/list-orders.use-case';

/**
 * VND — Vendas (§02). `ORDER_REPOSITORY` e `COMPANY_REPOSITORY` vêm do @Global RepositoriesModule;
 * este módulo cabeia os use cases e os lookups (Contato/Produto), pelo mesmo motivo do Produto: o VND
 * conhece um port com um método, e a infraestrutura sabe que aquilo é uma tabela de outro contexto —
 * sem importar o módulo do outro e ganhar acesso a `save`/`list` que não deveria ter.
 */
@Module({
  // StockModule fornece os use cases de reserva que o adapter EST usa. O VND depende do PORT, não do
  // módulo EST diretamente — o adapter é quem conhece o EST.
  imports: [
    MikroOrmModule.forFeature([ContactOrmEntity, ProductOrmEntity]),
    StockModule,
    // Preferências da conta (bloqueio por inadimplência, 06 §2.5) — o reader vem do AccountModule.
    AccountModule,
  ],
  providers: [
    { provide: CONTACT_OVERDUE_LOOKUP, useClass: MikroOrmContactOverdueLookup },
    { provide: CUSTOMER_LOOKUP, useClass: OrderCustomerLookup },
    { provide: ORDER_PRODUCT_LOOKUP, useClass: OrderProductLookup },
    { provide: ORDER_STOCK_RESERVATION, useClass: EstOrderStockReservation },
    CreateOrderUseCase,
    UpdateOrderUseCase,
    ChangeOrderStatusUseCase,
    GetOrderUseCase,
    ListOrdersUseCase,
  ],
  // Exportados porque a aprovação da Mesa despacha para os MESMOS use cases que o controller usa.
  exports: [
    CreateOrderUseCase,
    UpdateOrderUseCase,
    ChangeOrderStatusUseCase,
    GetOrderUseCase,
    ListOrdersUseCase,
  ],
})
export class OrderModule {}
