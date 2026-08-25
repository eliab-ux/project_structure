import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { validate } from './config/env.validation';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { MessagingModule } from './infrastructure/messaging/messaging.module';
import { HttpModule } from './infrastructure/http/http.module';
import { AuditModule } from './contexts/audit/audit.module';
import { AccountModule } from './contexts/account/account.module';
import { UserModule } from './contexts/user/user.module';
import { AuthModule } from './contexts/auth/auth.module';
import { PlatformModule } from './contexts/platform/platform.module';
import { ChannelModule } from './contexts/channel/channel.module';
import { AudienceModule } from './contexts/audience/audience.module';
import { ContentModule } from './contexts/content/content.module';
import { ApprovalModule } from './contexts/approval/approval.module';
import { DistributionModule } from './contexts/distribution/distribution.module';
import { DispatchModule } from './contexts/dispatch/dispatch.module';
import { InboxModule } from './contexts/inbox/inbox.module';
import { WhatsAppModule } from './infrastructure/whatsapp/whatsapp.module';

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
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          username: config.get<string>('REDIS_USERNAME') || undefined,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    // Shared infrastructure
    PersistenceModule,
    ObservabilityModule,
    SecurityModule,
    StorageModule,
    WhatsAppModule,
    MessagingModule,
    // Bounded contexts (FASE 1). Audit is @Global — nearly every context records something.
    AuditModule,
    AccountModule,
    UserModule,
    AuthModule,
    PlatformModule,
    ChannelModule,
    AudienceModule,
    ContentModule,
    ApprovalModule,
    DistributionModule,
    DispatchModule,
    InboxModule,
    // HTTP adapter last — it depends on the contexts above.
    HttpModule,
  ],
})
export class AppModule {}
