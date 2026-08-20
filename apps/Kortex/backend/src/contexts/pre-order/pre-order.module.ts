import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PreOrderOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/pre-order-orm.entity';
import { CutOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/cut-orm.entity';
import { MikroOrmCutHistoryRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-cut-history.repository';
import { CUT_HISTORY } from './application/ports/output/cut-history.port';
import { PreOrderMapper } from '../../infrastructure/persistence/mikro-orm/mappers/pre-order.mapper';
import { MikroOrmPreOrderRepository } from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-pre-order.repository';
import { CustomerModule } from '../customer/customer.module';
import { CatalogModule } from '../catalog/catalog.module';
import { UserModule } from '../user/user.module';
import { PRE_ORDER_REPOSITORY } from './application/ports/output/pre-order-repository.port';
import { PreOrderUseCases } from './application/use-cases/pre-order.use-cases';
import { ReferenceResolver } from './application/reference-resolver';

/**
 * O `ReferenceResolver` é exportado porque a fila de espera exibe os mesmos nomes (cliente,
 * tecido, produto, autor) — duplicá-lo daria duas versões da mesma resolução, e a segunda
 * divergiria na primeira mudança.
 */
@Module({
  imports: [
    // `CutOrmEntity` entra só para o adapter de histórico contar cortes — ler a tabela, não
    // depender do contexto. Importar o `CutModule` fecharia ciclo (o corte já importa este).
    MikroOrmModule.forFeature([PreOrderOrmEntity, CutOrmEntity]),
    // Para o ReferenceResolver: CUSTOMER_REPOSITORY, FABRIC_REPOSITORY,
    // PRODUCT_TYPE_REPOSITORY e USER_REPOSITORY.
    CustomerModule,
    CatalogModule,
    UserModule,
  ],
  providers: [
    PreOrderMapper,
    ReferenceResolver,
    { provide: PRE_ORDER_REPOSITORY, useClass: MikroOrmPreOrderRepository },
    { provide: CUT_HISTORY, useClass: MikroOrmCutHistoryRepository },
    PreOrderUseCases,
  ],
  exports: [PreOrderUseCases, ReferenceResolver, PRE_ORDER_REPOSITORY],
})
export class PreOrderModule {}
