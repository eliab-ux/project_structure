import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validate } from './config/env.validation';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { WhatsAppModule } from './infrastructure/whatsapp/whatsapp.module';
import { HttpModule } from './infrastructure/http/http.module';
import { AccountModule } from './contexts/account/account.module';
import { MachineModule } from './contexts/machine/machine.module';
import { UserModule } from './contexts/user/user.module';
import { AuthModule } from './contexts/auth/auth.module';
import { CustomerModule } from './contexts/customer/customer.module';
import { CatalogModule } from './contexts/catalog/catalog.module';
import { PreOrderModule } from './contexts/pre-order/pre-order.module';
import { WaitingListModule } from './contexts/waiting-list/waiting-list.module';
import { ScheduleModule } from './contexts/schedule/schedule.module';
import { CutModule } from './contexts/cut/cut.module';
import { FinanceModule } from './contexts/finance/finance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    // Domain events são publicados APÓS a persistência bem-sucedida (CLAUDE.md).
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
    // Infraestrutura compartilhada
    PersistenceModule,
    ObservabilityModule,
    SecurityModule,
    WhatsAppModule,
    // Bounded contexts — Fase 1
    AccountModule,
    MachineModule,
    UserModule,
    AuthModule,
    // Fase 2 — cadastros
    CustomerModule,
    CatalogModule,
    // Fase 3 — pré-pedido e fila de espera
    PreOrderModule,
    WaitingListModule,
    // Fase 4 — agenda, reserva e pagamento
    ScheduleModule,
    // Fase 5 — apontamento e histórico
    CutModule,
    // Fase 6 — caixa e mini DRE
    FinanceModule,
    // Adapter HTTP por último — depende dos contexts acima.
    HttpModule,
  ],
})
export class AppModule {}
