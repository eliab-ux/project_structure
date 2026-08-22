import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ContactOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-orm.entity';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { OrderCustomerLookup } from '../../infrastructure/persistence/mikro-orm/repositories/order-customer.lookup';
import { OrderProductLookup } from '../../infrastructure/persistence/mikro-orm/repositories/order-product.lookup';
import { CUSTOMER_LOOKUP } from './application/ports/output/customer-lookup.port';
import { ORDER_PRODUCT_LOOKUP } from './application/ports/output/order-product-lookup.port';
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
  imports: [MikroOrmModule.forFeature([ContactOrmEntity, ProductOrmEntity])],
  providers: [
    { provide: CUSTOMER_LOOKUP, useClass: OrderCustomerLookup },
    { provide: ORDER_PRODUCT_LOOKUP, useClass: OrderProductLookup },
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
