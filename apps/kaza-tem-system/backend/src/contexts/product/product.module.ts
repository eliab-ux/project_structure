import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { ProductImageOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-image-orm.entity';
import { PRODUCT_REPOSITORY } from './application/ports/output/product-repository.port';
import { MikroOrmProductRepository } from '../../infrastructure/persistence/mikro-orm/repositories/product.repository';
import { ProductMapper } from '../../infrastructure/persistence/mikro-orm/mappers/product.mapper';
import { GetProductByIdUseCase } from './application/use-cases/get-product/get-product.use-case';
import { SearchProductsUseCase } from './application/use-cases/search-products/search-products.use-case';
import { PRODUCT_IMAGE_REPOSITORY } from './application/ports/output/product-image-repository.port';
import { MikroOrmProductImageRepository } from '../../infrastructure/persistence/mikro-orm/repositories/product-image.repository';
import { ListProductsForMarketplaceUseCase } from './application/use-cases/marketplace/list-products-marketplace.use-case';
import { CreateProductFromMarketplaceUseCase } from './application/use-cases/marketplace/create-product-marketplace.use-case';
import { UpdateProductFromMarketplaceUseCase } from './application/use-cases/marketplace/update-product-marketplace.use-case';
import { DeactivateProductFromMarketplaceUseCase } from './application/use-cases/marketplace/deactivate-product-marketplace.use-case';
import { ListAdminProductsUseCase } from './application/use-cases/admin/list-admin-products.use-case';
import { ToggleProductActiveUseCase } from './application/use-cases/admin/toggle-product-active.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([ProductOrmEntity, ProductImageOrmEntity])],
  providers: [
    ProductMapper,
    {
      provide: PRODUCT_REPOSITORY,
      useClass: MikroOrmProductRepository,
    },
    {
      provide: PRODUCT_IMAGE_REPOSITORY,
      useClass: MikroOrmProductImageRepository,
    },
    GetProductByIdUseCase,
    SearchProductsUseCase,
    ListProductsForMarketplaceUseCase,
    CreateProductFromMarketplaceUseCase,
    UpdateProductFromMarketplaceUseCase,
    DeactivateProductFromMarketplaceUseCase,
    ListAdminProductsUseCase,
    ToggleProductActiveUseCase,
  ],
  exports: [
    GetProductByIdUseCase,
    SearchProductsUseCase,
    ListProductsForMarketplaceUseCase,
    CreateProductFromMarketplaceUseCase,
    UpdateProductFromMarketplaceUseCase,
    DeactivateProductFromMarketplaceUseCase,
    ListAdminProductsUseCase,
    ToggleProductActiveUseCase,
    PRODUCT_REPOSITORY,
    PRODUCT_IMAGE_REPOSITORY,
  ],
})
export class ProductModule {}
