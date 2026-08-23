import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { StockProductLookup } from '../../infrastructure/persistence/mikro-orm/repositories/stock-product.lookup';
import { NoopConsignmentFiscal } from '../../infrastructure/observability/noop-consignment-fiscal';
import { AccountModule } from '../account/account.module';
import { STOCK_PRODUCT_LOOKUP } from '../stock/application/ports/output/stock-product-lookup.port';
import { CONSIGNMENT_FISCAL } from './application/ports/output/consignment-fiscal.port';
import { CreateRouteUseCase } from './application/use-cases/create-route/create-route.use-case';
import { ListRoutesUseCase } from './application/use-cases/list-routes/list-routes.use-case';
import { UpdateRouteUseCase } from './application/use-cases/update-route/update-route.use-case';
import { GetCommercialRuleUseCase } from './application/use-cases/get-commercial-rule/get-commercial-rule.use-case';
import { SetCommercialRuleUseCase } from './application/use-cases/set-commercial-rule/set-commercial-rule.use-case';
import { CreateTripUseCase } from './application/use-cases/create-trip/create-trip.use-case';
import { ChangeTripStatusUseCase } from './application/use-cases/change-trip-status/change-trip-status.use-case';
import { ListTripsUseCase } from './application/use-cases/list-trips/list-trips.use-case';
import { LoadTripCargoUseCase } from './application/use-cases/load-trip-cargo/load-trip-cargo.use-case';

/**
 * ROT — Rota/Consignação (§04). Fatia 2: rotas + Regra Comercial. Fatia 3: viagem + carga/romaneio +
 * ciclo consignado. Os repositórios vêm do @Global RepositoriesModule; o lookup de produto (validar
 * itens da carga) e o `CONSIGNMENT_FISCAL` (fronteira ROT↔FIS — **no-op** até o FIS existir, 07 §2)
 * são locais. `AccountModule` fornece o `AccountPreferencesReader` (estoque negativo na carga).
 */
@Module({
  imports: [MikroOrmModule.forFeature([ProductOrmEntity]), AccountModule],
  providers: [
    { provide: STOCK_PRODUCT_LOOKUP, useClass: StockProductLookup },
    { provide: CONSIGNMENT_FISCAL, useClass: NoopConsignmentFiscal },
    CreateRouteUseCase,
    ListRoutesUseCase,
    UpdateRouteUseCase,
    GetCommercialRuleUseCase,
    SetCommercialRuleUseCase,
    CreateTripUseCase,
    ChangeTripStatusUseCase,
    ListTripsUseCase,
    LoadTripCargoUseCase,
  ],
  exports: [
    CreateRouteUseCase,
    ListRoutesUseCase,
    UpdateRouteUseCase,
    GetCommercialRuleUseCase,
    SetCommercialRuleUseCase,
    CreateTripUseCase,
    ChangeTripStatusUseCase,
    ListTripsUseCase,
    LoadTripCargoUseCase,
  ],
})
export class RouteModule {}
