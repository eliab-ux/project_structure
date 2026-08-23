import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { PriceProductLookup } from '../../infrastructure/persistence/mikro-orm/repositories/price-product.lookup';
import { PRICE_PRODUCT_LOOKUP } from './application/ports/output/price-product-lookup.port';
import { CreatePriceListUseCase } from './application/use-cases/create-price-list/create-price-list.use-case';
import { UpdatePriceListUseCase } from './application/use-cases/update-price-list/update-price-list.use-case';
import { ListPriceListsUseCase } from './application/use-cases/list-price-lists/list-price-lists.use-case';
import { ResolvePriceUseCase } from './application/use-cases/resolve-price/resolve-price.use-case';

/**
 * Tabelas de preço (VND — §3.2 do 02A). O `PRICE_LIST_REPOSITORY` vem do @Global RepositoriesModule;
 * o `PRICE_PRODUCT_LOOKUP` (preço base do produto para o fallback) é local, como o lookup do EST.
 */
@Module({
  imports: [MikroOrmModule.forFeature([ProductOrmEntity])],
  providers: [
    { provide: PRICE_PRODUCT_LOOKUP, useClass: PriceProductLookup },
    CreatePriceListUseCase,
    UpdatePriceListUseCase,
    ListPriceListsUseCase,
    ResolvePriceUseCase,
  ],
  exports: [
    CreatePriceListUseCase,
    UpdatePriceListUseCase,
    ListPriceListsUseCase,
    ResolvePriceUseCase,
  ],
})
export class PriceListModule {}
