import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { validate } from './config/env.validation';
import { AuthModule } from './contexts/auth/auth.module';
import { CatalogModule } from './contexts/catalog/catalog.module';
import { DispatchModule } from './contexts/dispatch/dispatch.module';
import { ScheduleModule } from './contexts/schedule/schedule.module';
import { UserModule } from './contexts/user/user.module';
import { WhatsappModule } from './contexts/whatsapp/whatsapp.module';
import { HttpModule } from './infrastructure/http/http.module';
import { isQueueEnabled } from './infrastructure/jobs/jobs.constants';
import { JobsModule } from './infrastructure/jobs/jobs.module';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { SecurityModule } from './infrastructure/security/security.module';

/**
 * O `JobsModule` (BullMQ) entra apenas quando há Redis configurado. Sem ele a API funciona
 * inteira e só o envio automático fica desligado — assim um deploy não quebra por causa de um
 * serviço de Redis que ainda não existe, e o `POST /dispatch/send-now` continua disponível.
 */
function optionalJobsModule(): Array<typeof JobsModule> {
  return isQueueEnabled() ? [JobsModule] : [];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
    // Infraestrutura compartilhada
    PersistenceModule,
    SecurityModule,
    ObservabilityModule,
    // Bounded contexts
    UserModule,
    AuthModule,
    CatalogModule,
    WhatsappModule,
    ScheduleModule,
    DispatchModule,
    // HTTP adapter (depende dos contexts acima)
    HttpModule,
    // Jobs em background (só com Redis)
    ...optionalJobsModule(),
  ],
})
export class AppModule {}
