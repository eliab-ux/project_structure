import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { validate } from './config/env.validation';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { HttpModule } from './infrastructure/http/http.module';
import { JobsModule } from './infrastructure/jobs/jobs.module';
import { IntegrationsModule } from './infrastructure/integrations/integrations.module';
import { AuthModule } from './contexts/auth/auth.module';
import { UserModule } from './contexts/user/user.module';
import { ConnectionModule } from './contexts/connection/connection.module';
import { WatchlistModule } from './contexts/watchlist/watchlist.module';
import { ContentModule } from './contexts/content/content.module';
import { InsightModule } from './contexts/insight/insight.module';
import { DetectionModule } from './contexts/detection/detection.module';

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
        },
      }),
    }),
    // Shared infrastructure
    PersistenceModule,
    SecurityModule,
    ObservabilityModule,
    IntegrationsModule,
    // Bounded contexts
    UserModule,
    AuthModule,
    ConnectionModule,
    WatchlistModule,
    ContentModule,
    InsightModule,
    DetectionModule,
    // HTTP + background jobs (depend on the contexts above)
    HttpModule,
    JobsModule,
  ],
})
export class AppModule {}
