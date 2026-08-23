import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/product-orm.entity';
import { StockProductLookup } from '../../infrastructure/persistence/mikro-orm/repositories/stock-product.lookup';
import { NoopConsignmentFiscal } from '../../infrastructure/observability/noop-consignment-fiscal';
import { AccountModule } from '../account/account.module';
import { FinanceModule } from '../finance/finance.module';
import { WalletTitleLookup } from '../../infrastructure/persistence/mikro-orm/repositories/wallet-title.lookup';
import { RotWalletParamsReader } from '../../infrastructure/persistence/mikro-orm/repositories/rot-wallet-params.reader';
import { STOCK_PRODUCT_LOOKUP } from '../stock/application/ports/output/stock-product-lookup.port';
import { CONSIGNMENT_FISCAL } from './application/ports/output/consignment-fiscal.port';
import { WALLET_TITLE_LOOKUP } from './application/ports/output/wallet-title-lookup.port';
import { ROT_WALLET_PARAMS } from './application/ports/output/rot-wallet-params.port';
import { CreateRouteUseCase } from './application/use-cases/create-route/create-route.use-case';
import { ListRoutesUseCase } from './application/use-cases/list-routes/list-routes.use-case';
import { UpdateRouteUseCase } from './application/use-cases/update-route/update-route.use-case';
import { GetCommercialRuleUseCase } from './application/use-cases/get-commercial-rule/get-commercial-rule.use-case';
import { SetCommercialRuleUseCase } from './application/use-cases/set-commercial-rule/set-commercial-rule.use-case';
import { CreateTripUseCase } from './application/use-cases/create-trip/create-trip.use-case';
import { ChangeTripStatusUseCase } from './application/use-cases/change-trip-status/change-trip-status.use-case';
import { ListTripsUseCase } from './application/use-cases/list-trips/list-trips.use-case';
import { GetTripDetailsUseCase } from './application/use-cases/get-trip-details/get-trip-details.use-case';
import { LoadTripCargoUseCase } from './application/use-cases/load-trip-cargo/load-trip-cargo.use-case';
import { BuildTripWalletUseCase } from './application/use-cases/build-trip-wallet/build-trip-wallet.use-case';
import { RegisterFieldReceiptUseCase } from './application/use-cases/register-field-receipt/register-field-receipt.use-case';
import { EffectuateFieldReceiptUseCase } from './application/use-cases/effectuate-field-receipt/effectuate-field-receipt.use-case';
import { ReturnConsignedItemsUseCase } from './application/use-cases/return-consigned-items/return-consigned-items.use-case';
import { ExchangeConsignedItemsUseCase } from './application/use-cases/exchange-consigned-items/exchange-consigned-items.use-case';
import { RegisterTripExpenseUseCase } from './application/use-cases/register-trip-expense/register-trip-expense.use-case';
import { CloseTripUseCase } from './application/use-cases/close-trip/close-trip.use-case';
import { RegisterOrderEvidenceUseCase } from './application/use-cases/register-order-evidence/register-order-evidence.use-case';
import { ChangeOrderGpsUseCase } from './application/use-cases/change-order-gps/change-order-gps.use-case';
import { GeneratePromissoryNoteUseCase } from './application/use-cases/generate-promissory-note/generate-promissory-note.use-case';
import { OpenConsignedOrderUseCase } from './application/use-cases/open-consigned-order/open-consigned-order.use-case';
import { CloseConsignedOrderUseCase } from './application/use-cases/close-consigned-order/close-consigned-order.use-case';
import { EVIDENCE_STORAGE } from './application/ports/output/evidence-storage.port';
import { PROMISSORY_DEBTOR_LOOKUP } from './application/ports/output/promissory-debtor-lookup.port';
import { NoopEvidenceStorage } from '../../infrastructure/observability/noop-evidence-storage';
import { MinioEvidenceStorage } from '../../infrastructure/storage/minio-evidence-storage';
import { CONTACT_GEO } from './application/ports/output/contact-geo.port';
import { MikroOrmContactGeo } from '../../infrastructure/persistence/mikro-orm/repositories/contact-geo.adapter';
import { PromissoryDebtorLookup } from '../../infrastructure/persistence/mikro-orm/repositories/promissory-debtor.lookup';

/**
 * ROT — Rota/Consignação (§04). Fatia 2: rotas + Regra Comercial. Fatia 3: viagem + carga/romaneio +
 * ciclo consignado. Os repositórios vêm do @Global RepositoriesModule; o lookup de produto (validar
 * itens da carga) e o `CONSIGNMENT_FISCAL` (fronteira ROT↔FIS — **no-op** até o FIS existir, 07 §2)
 * são locais. `AccountModule` fornece o `AccountPreferencesReader` (estoque negativo na carga).
 */
@Module({
  imports: [MikroOrmModule.forFeature([ProductOrmEntity]), AccountModule, FinanceModule],
  providers: [
    { provide: STOCK_PRODUCT_LOOKUP, useClass: StockProductLookup },
    { provide: CONSIGNMENT_FISCAL, useClass: NoopConsignmentFiscal },
    { provide: WALLET_TITLE_LOOKUP, useClass: WalletTitleLookup },
    { provide: ROT_WALLET_PARAMS, useClass: RotWalletParamsReader },
    {
      // MinIO real quando configurado (MINIO_ENDPOINT); no-op em dev sem servidor — o registro da
      // evidência (linha + chave) funciona igual nos dois; só o binário muda de destino.
      provide: EVIDENCE_STORAGE,
      useFactory: () =>
        process.env.MINIO_ENDPOINT ? new MinioEvidenceStorage() : new NoopEvidenceStorage(),
    },
    { provide: CONTACT_GEO, useClass: MikroOrmContactGeo },
    { provide: PROMISSORY_DEBTOR_LOOKUP, useClass: PromissoryDebtorLookup },
    CreateRouteUseCase,
    ListRoutesUseCase,
    UpdateRouteUseCase,
    GetCommercialRuleUseCase,
    SetCommercialRuleUseCase,
    CreateTripUseCase,
    ChangeTripStatusUseCase,
    ListTripsUseCase,
    GetTripDetailsUseCase,
    LoadTripCargoUseCase,
    BuildTripWalletUseCase,
    RegisterFieldReceiptUseCase,
    EffectuateFieldReceiptUseCase,
    ReturnConsignedItemsUseCase,
    ExchangeConsignedItemsUseCase,
    RegisterTripExpenseUseCase,
    CloseTripUseCase,
    RegisterOrderEvidenceUseCase,
    ChangeOrderGpsUseCase,
    GeneratePromissoryNoteUseCase,
    OpenConsignedOrderUseCase,
    CloseConsignedOrderUseCase,
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
    GetTripDetailsUseCase,
    LoadTripCargoUseCase,
    BuildTripWalletUseCase,
    RegisterFieldReceiptUseCase,
    EffectuateFieldReceiptUseCase,
    ReturnConsignedItemsUseCase,
    ExchangeConsignedItemsUseCase,
    RegisterTripExpenseUseCase,
    CloseTripUseCase,
    RegisterOrderEvidenceUseCase,
    ChangeOrderGpsUseCase,
    GeneratePromissoryNoteUseCase,
    OpenConsignedOrderUseCase,
    CloseConsignedOrderUseCase,
  ],
})
export class RouteModule {}
