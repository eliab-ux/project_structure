import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { StockProductLookup } from '../../infrastructure/persistence/mikro-orm/repositories/stock-product.lookup';
import { AccountModule } from '../account/account.module';
import { STOCK_PRODUCT_LOOKUP } from './application/ports/output/stock-product-lookup.port';
import { RegisterMovementUseCase } from './application/use-cases/register-movement/register-movement.use-case';
import { GetStockBalanceUseCase } from './application/use-cases/get-stock-balance/get-stock-balance.use-case';
import { ListMovementsUseCase } from './application/use-cases/list-movements/list-movements.use-case';

/**
 * EST — Estoque (§03). `STOCK_MOVEMENT_REPOSITORY` vem do @Global RepositoriesModule; este módulo
 * cabeia os use cases e o lookup de produto (mín/máx), pelo mesmo motivo dos demais: o EST conhece um
 * port, e a infraestrutura sabe que aquilo é a tabela de produtos. `AccountModule` fornece o
 * `AccountPreferencesReader` (preferência de estoque negativo, §3.2).
 */
@Module({
  imports: [MikroOrmModule.forFeature([ProductOrmEntity]), AccountModule],
  providers: [
    { provide: STOCK_PRODUCT_LOOKUP, useClass: StockProductLookup },
    RegisterMovementUseCase,
    GetStockBalanceUseCase,
    ListMovementsUseCase,
  ],
  exports: [RegisterMovementUseCase, GetStockBalanceUseCase, ListMovementsUseCase],
})
export class StockModule {}
