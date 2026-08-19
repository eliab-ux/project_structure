import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { ProductSupplierOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-supplier-orm.entity';
import { ContactOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-orm.entity';
import { ProductMapper } from '../../infrastructure/persistence/mikro-orm/mappers/product.mapper';
import { MikroOrmProductRepository } from '../../infrastructure/persistence/mikro-orm/repositories/product.repository';
import { ContactSupplierLookup } from '../../infrastructure/persistence/mikro-orm/repositories/contact-supplier.lookup';
import { PRODUCT_REPOSITORY } from './application/ports/output/product-repository.port';
import { SUPPLIER_LOOKUP } from './application/ports/output/supplier-lookup.port';
import { CreateProductUseCase } from './application/use-cases/create-product/create-product.use-case';
import { UpdateProductUseCase } from './application/use-cases/update-product/update-product.use-case';
import { ListProductsUseCase } from './application/use-cases/list-products/list-products.use-case';
import { GetProductUseCase } from './application/use-cases/get-product/get-product.use-case';

/**
 * O módulo de Produto.
 *
 * `ContactOrmEntity` aparece aqui, e não é acoplamento ao módulo de Contato: quem a usa é o
 * `ContactSupplierLookup`, o adapter do `SupplierLookupPort` — o Produto conhece um port com um
 * método (*"este id é fornecedor, e como se chama?"*), e a infraestrutura é quem sabe que aquilo é
 * uma tabela de contatos. Importar o `ContactModule` daria ao Produto acesso a `save` e `list` de
 * contatos, que ele não usa e não deveria ter.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([ProductOrmEntity, ProductSupplierOrmEntity, ContactOrmEntity]),
  ],
  providers: [
    ProductMapper,
    { provide: PRODUCT_REPOSITORY, useClass: MikroOrmProductRepository },
    { provide: SUPPLIER_LOOKUP, useClass: ContactSupplierLookup },
    CreateProductUseCase,
    UpdateProductUseCase,
    ListProductsUseCase,
    GetProductUseCase,
  ],
  // Exportados porque a aprovação da Mesa despacha para os MESMOS use cases que o controller usa —
  // é isso que impede a intenção de ser um caminho com validação mais frouxa.
  exports: [CreateProductUseCase, UpdateProductUseCase, ListProductsUseCase, GetProductUseCase],
})
export class ProductModule {}
