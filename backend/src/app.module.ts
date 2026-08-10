import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validate } from './config/env.validation';
import { BootstrapModule } from './infrastructure/persistence/bootstrap/bootstrap.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { RepositoriesModule } from './infrastructure/persistence/repositories.module';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { MessagingModule } from './infrastructure/messaging/messaging.module';
import { WhatsAppModule } from './infrastructure/whatsapp/whatsapp.module';
import { HttpModule } from './infrastructure/http/http.module';
import { TenantTransactionInterceptor } from './infrastructure/http/interceptors/tenant-transaction.interceptor';
import { PlanModule } from './contexts/plan/plan.module';
import { AccountModule } from './contexts/account/account.module';
import { CompanyModule } from './contexts/company/company.module';
import { RoleModule } from './contexts/role/role.module';
import { UserModule } from './contexts/user/user.module';
import { AuthModule } from './contexts/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: '.env' }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 20 }),
    // Migrate → verify isolation → seed, before the first request is served. Listed first so its
    // lifecycle hook is the first to run; a failure here aborts the boot instead of serving traffic
    // against an unverified database.
    BootstrapModule,
    // Shared infrastructure — all @Global.
    PersistenceModule,
    RepositoriesModule,
    ObservabilityModule,
    SecurityModule,
    MessagingModule,
    WhatsAppModule,
    // Bounded contexts (F1).
    PlanModule,
    AccountModule,
    CompanyModule,
    RoleModule,
    UserModule,
    AuthModule,
    // HTTP adapter last — it depends on the contexts above.
    HttpModule,
  ],
  providers: [
    {
      /**
       * Global, not per-controller. Real RLS needs a transaction-local `set_config`, so a request
       * without a transaction has no tenant scope and — with the policies in place — reads nothing.
       * Registering this globally means a route someone forgets to annotate is safe rather than
       * unscoped. `/health` opts out explicitly with `@SkipTenantTransaction`.
       */
      provide: APP_INTERCEPTOR,
      useClass: TenantTransactionInterceptor,
    },
  ],
})
export class AppModule {}
