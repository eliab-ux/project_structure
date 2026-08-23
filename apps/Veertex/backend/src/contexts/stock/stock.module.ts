import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { StockProductLookup } from '../../infrastructure/persistence/mikro-orm/repositories/stock-product.lookup';
import { AccountModule } from '../account/account.module';
import { STOCK_PRODUCT_LOOKUP } from './application/ports/output/stock-product-lookup.port';
import { RegisterMovementUseCase } from './application/use-cases/register-movement/register-movement.use-case';
import { GetStockBalanceUseCase } from './application/use-cases/get-stock-balance/get-stock-balance.use-case';
import { ListStockReservationsUseCase } from './application/use-cases/list-stock-reservations/list-stock-reservations.use-case';
import { ListMovementsUseCase } from './application/use-cases/list-movements/list-movements.use-case';
import { TransferStockUseCase } from './application/use-cases/transfer-stock/transfer-stock.use-case';
import { CreateStockLocationUseCase } from './application/use-cases/create-stock-location/create-stock-location.use-case';
import { ListStockLocationsUseCase } from './application/use-cases/list-stock-locations/list-stock-locations.use-case';
import { ReserveOrderStockUseCase } from './application/use-cases/reserve-order-stock/reserve-order-stock.use-case';
import { ReleaseOrderReservationsUseCase } from './application/use-cases/release-order-reservations/release-order-reservations.use-case';

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
    ListStockReservationsUseCase,
    TransferStockUseCase,
    CreateStockLocationUseCase,
    ListStockLocationsUseCase,
    ReserveOrderStockUseCase,
    ReleaseOrderReservationsUseCase,
  ],
  exports: [
    RegisterMovementUseCase,
    GetStockBalanceUseCase,
    ListMovementsUseCase,
    ListStockReservationsUseCase,
    TransferStockUseCase,
    CreateStockLocationUseCase,
    ListStockLocationsUseCase,
    ReserveOrderStockUseCase,
    ReleaseOrderReservationsUseCase,
  ],
})
export class StockModule {}
