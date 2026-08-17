import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { FabricOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/fabric-orm.entity';
import { ProductTypeOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-type-orm.entity';
import {
  FabricMapper,
  ProductTypeMapper,
} from '../../infrastructure/persistence/mikro-orm/mappers/catalog.mapper';
import {
  MikroOrmFabricRepository,
  MikroOrmProductTypeRepository,
} from '../../infrastructure/persistence/mikro-orm/repositories/mikro-orm-catalog.repository';
import {
  FABRIC_REPOSITORY,
  PRODUCT_TYPE_REPOSITORY,
} from './application/ports/output/catalog-repository.port';
import { FabricUseCases } from './application/use-cases/fabric.use-cases';
import { ProductTypeUseCases } from './application/use-cases/product-type.use-cases';

/**
 * Tecido e tipo de produto vivem no mesmo context: são os dois cadastros de apoio que o
 * pré-pedido e o apontamento consomem, ambos triviais e ambos com a mesma regra de nome único.
 */
@Module({
  imports: [MikroOrmModule.forFeature([FabricOrmEntity, ProductTypeOrmEntity])],
  providers: [
    FabricMapper,
    ProductTypeMapper,
    { provide: FABRIC_REPOSITORY, useClass: MikroOrmFabricRepository },
    { provide: PRODUCT_TYPE_REPOSITORY, useClass: MikroOrmProductTypeRepository },
    FabricUseCases,
    ProductTypeUseCases,
  ],
  // Os tokens saem para o `ReferenceResolver` da Fase 3 resolver nome de tecido e de produto.
  exports: [FabricUseCases, ProductTypeUseCases, FABRIC_REPOSITORY, PRODUCT_TYPE_REPOSITORY],
})
export class CatalogModule {}
