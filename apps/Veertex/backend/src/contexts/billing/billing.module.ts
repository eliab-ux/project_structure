import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import {
  GetBillingConfigUseCase,
  SetBillingConfigUseCase,
  TestBillingConnectionUseCase,
} from './application/use-cases/billing-config/billing-config.use-cases';
import { EmitChargeUseCase } from './application/use-cases/emit-charge/emit-charge.use-case';
import { HandleBillingWebhookUseCase } from './application/use-cases/handle-billing-webhook/handle-billing-webhook.use-case';
import {
  ApproveDunningEventUseCase,
  GetDunningRuleUseCase,
  RunDunningUseCase,
  SaveDunningRuleUseCase,
} from './application/use-cases/dunning/dunning.use-cases';
import { RenegotiateTitlesUseCase } from './application/use-cases/renegotiate-titles/renegotiate-titles.use-case';
import { BILLING_PROVIDER } from './application/ports/output/billing-provider.port';
import {
  BILLING_WEBHOOK_EVENT_REPOSITORY,
  CHARGE_REPOSITORY,
  DUNNING_EVENT_REPOSITORY,
  DUNNING_RULE_REPOSITORY,
} from './application/ports/output/billing-repositories.port';
import { BILLING_CONFIG_REPOSITORY } from './application/ports/output/billing-config-repository.port';
import {
  BILLING_PAYER_LOOKUP,
  BILLING_PDF_STORAGE,
  CREDENTIALS_CIPHER,
  DUNNING_MESSENGER,
} from './application/ports/output/billing-support.ports';
import { NotConfiguredBillingProvider } from '../../infrastructure/billing/not-configured-billing-provider';
import { AesCredentialsCipher } from '../../infrastructure/billing/credentials-cipher';
import { EvolutionDunningMessenger } from '../../infrastructure/billing/dunning.messenger';
import {
  MinioBillingPdfStorage,
  NoopBillingPdfStorage,
} from '../../infrastructure/billing/billing-pdf-storage';
import {
  MikroOrmBillingConfigRepository,
  MikroOrmBillingWebhookEventRepository,
  MikroOrmChargeRepository,
  MikroOrmDunningEventRepository,
  MikroOrmDunningRuleRepository,
} from '../../infrastructure/persistence/mikro-orm/repositories/billing.repositories';
import { BillingContactLookup } from '../../infrastructure/persistence/mikro-orm/repositories/billing-contact.lookup';

/**
 * COB — Cobrança (06). `COB → FIN` (aceite 1): o módulo importa o FinanceModule (baixa e títulos).
 * O provider default é o NOT-CONFIGURED (fail closed): o agregador real
 * (Kobana/TecnoSpeed/Asaas) entra trocando ESTE provider quando a credencial chegar.
 */
@Module({
  imports: [FinanceModule],
  providers: [
    SetBillingConfigUseCase,
    GetBillingConfigUseCase,
    TestBillingConnectionUseCase,
    EmitChargeUseCase,
    HandleBillingWebhookUseCase,
    SaveDunningRuleUseCase,
    GetDunningRuleUseCase,
    RunDunningUseCase,
    ApproveDunningEventUseCase,
    RenegotiateTitlesUseCase,
    { provide: BILLING_PROVIDER, useClass: NotConfiguredBillingProvider },
    { provide: CREDENTIALS_CIPHER, useClass: AesCredentialsCipher },
    { provide: DUNNING_MESSENGER, useClass: EvolutionDunningMessenger },
    {
      // MinIO real quando configurado; no-op em dev — a emissão funciona, só o PDF não arquiva.
      provide: BILLING_PDF_STORAGE,
      useFactory: () =>
        process.env.MINIO_ENDPOINT ? new MinioBillingPdfStorage() : new NoopBillingPdfStorage(),
    },
    { provide: BILLING_CONFIG_REPOSITORY, useClass: MikroOrmBillingConfigRepository },
    { provide: CHARGE_REPOSITORY, useClass: MikroOrmChargeRepository },
    { provide: DUNNING_RULE_REPOSITORY, useClass: MikroOrmDunningRuleRepository },
    { provide: DUNNING_EVENT_REPOSITORY, useClass: MikroOrmDunningEventRepository },
    { provide: BILLING_WEBHOOK_EVENT_REPOSITORY, useClass: MikroOrmBillingWebhookEventRepository },
    { provide: BILLING_PAYER_LOOKUP, useClass: BillingContactLookup },
  ],
  exports: [
    SetBillingConfigUseCase,
    GetBillingConfigUseCase,
    TestBillingConnectionUseCase,
    EmitChargeUseCase,
    HandleBillingWebhookUseCase,
    SaveDunningRuleUseCase,
    GetDunningRuleUseCase,
    RunDunningUseCase,
    ApproveDunningEventUseCase,
    RenegotiateTitlesUseCase,
    BILLING_CONFIG_REPOSITORY,
    CHARGE_REPOSITORY,
    DUNNING_EVENT_REPOSITORY,
    CREDENTIALS_CIPHER,
  ],
})
export class BillingModule {}
