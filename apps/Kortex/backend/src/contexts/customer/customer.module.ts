import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CustomerOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/customer-orm.entity';
import { CustomerMapper } from '../../infrastructure/persistence/mikro-orm/mappers/customer.mapper';
import { MikroOrmCustomerRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-customer.repository';
import { CUSTOMER_REPOSITORY } from './application/ports/output/customer-repository.port';
import { QueryCustomersUseCase } from './application/use-cases/query-customers/query-customers.use-case';
import { CreateCustomerUseCase } from './application/use-cases/create-customer/create-customer.use-case';
import { UpdateCustomerUseCase } from './application/use-cases/update-customer/update-customer.use-case';
import { SetCustomerStatusUseCase } from './application/use-cases/set-customer-status/set-customer-status.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([CustomerOrmEntity])],
  providers: [
    CustomerMapper,
    { provide: CUSTOMER_REPOSITORY, useClass: MikroOrmCustomerRepository },
    QueryCustomersUseCase,
    CreateCustomerUseCase,
    UpdateCustomerUseCase,
    SetCustomerStatusUseCase,
  ],
  exports: [
    QueryCustomersUseCase,
    CreateCustomerUseCase,
    UpdateCustomerUseCase,
    SetCustomerStatusUseCase,
    // O `ReferenceResolver` da Fase 3 resolve o nome fantasia do cliente no pré-pedido e na fila.
    CUSTOMER_REPOSITORY,
  ],
})
export class CustomerModule {}
