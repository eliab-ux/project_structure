import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from './config/env.validation';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { PresenceModule } from './infrastructure/realtime/presence.module';
import { NotificationModule } from './infrastructure/notification/notification.module';
import { HttpModule } from './infrastructure/http/http.module';
import { RealtimeModule } from './infrastructure/realtime/realtime.module';
import { JobsModule } from './infrastructure/jobs/jobs.module';
import { PsicologoModule } from './contexts/psicologo/psicologo.module';
import { PacienteModule } from './contexts/paciente/paciente.module';
import { SessionModule } from './contexts/session/session.module';
import { WhatsappModule } from './contexts/whatsapp/whatsapp.module';
import { AuthModule } from './contexts/auth/auth.module';

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
    ScheduleModule.forRoot(),
    // Shared infrastructure
    PersistenceModule,
    SecurityModule,
    ObservabilityModule,
    PresenceModule,
    NotificationModule,
    // Bounded contexts
    PsicologoModule,
    PacienteModule,
    SessionModule,
    WhatsappModule,
    AuthModule,
    // HTTP + Real-time adapters (depend on the contexts above)
    HttpModule,
    RealtimeModule,
    JobsModule,
  ],
})
export class AppModule {}
