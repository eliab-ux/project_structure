import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config';
import { ThrottleConfig } from '../../config/throttle.config';
import { CHANNEL_REPOSITORY } from './application/ports/output/channel-repository.port';
import {
  CHANNEL_DAILY_COUNTER_REPOSITORY,
  CHANNEL_QUALITY_SNAPSHOT_REPOSITORY,
  CHANNEL_SIGNAL_SOURCE,
} from './application/ports/output/channel-signals.port';
import { WEBHOOK_DIAGNOSIS_SOURCE } from './application/ports/output/webhook-diagnosis-source.port';
import { CreateChannelUseCase } from './application/use-cases/create-channel/create-channel.use-case';
import { ListChannelsUseCase } from './application/use-cases/list-channels/list-channels.use-case';
import { GetChannelUseCase } from './application/use-cases/get-channel/get-channel.use-case';
import { GetChannelQrCodeUseCase } from './application/use-cases/get-channel-qrcode/get-channel-qrcode.use-case';
import { SyncConnectionStateUseCase } from './application/use-cases/sync-connection-state/sync-connection-state.use-case';
import { DiagnoseWebhookUseCase } from './application/use-cases/diagnose-webhook/diagnose-webhook.use-case';
import { UpdateQuotaBandUseCase } from './application/use-cases/update-quota-band/update-quota-band.use-case';
import { DisconnectChannelUseCase } from './application/use-cases/disconnect-channel/disconnect-channel.use-case';
import { RetireChannelUseCase } from './application/use-cases/retire-channel/retire-channel.use-case';
import { MarkChannelBannedUseCase } from './application/use-cases/mark-channel-banned/mark-channel-banned.use-case';
import { ReinstateChannelUseCase } from './application/use-cases/reinstate-channel/reinstate-channel.use-case';
import { ReviewChannelQuotaUseCase } from './application/use-cases/review-channel-quota/review-channel-quota.use-case';
import { GetChannelHealthUseCase } from './application/use-cases/get-channel-health/get-channel-health.use-case';
import { RegisterSendOutcomeUseCase } from './application/use-cases/register-send-outcome/register-send-outcome.use-case';
import { ApplyConnectionUpdateUseCase } from './application/use-cases/apply-connection-update/apply-connection-update.use-case';
import { ChannelOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/channel-orm.entity';
import { ChannelDailyCounterOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/channel-daily-counter-orm.entity';
import { ChannelQualitySnapshotOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/channel-quality-snapshot-orm.entity';
import { ChannelMapper } from '../../infrastructure/persistence/mikro-orm/mappers/channel.mapper';
import { MikroOrmChannelRepository } from '../../infrastructure/persistence/mikro-orm/repositories/channel.repository';
import {
  MikroOrmChannelDailyCounterRepository,
  MikroOrmChannelQualitySnapshotRepository,
  MikroOrmChannelSignalSource,
} from '../../infrastructure/persistence/mikro-orm/repositories/channel-signals.repository';
import { MikroOrmWebhookDiagnosisSource } from '../../infrastructure/persistence/mikro-orm/repositories/webhook-diagnosis-source.repository';

@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forFeature([
      ChannelOrmEntity,
      ChannelDailyCounterOrmEntity,
      ChannelQualitySnapshotOrmEntity,
    ]),
  ],
  providers: [
    ThrottleConfig,
    ChannelMapper,
    { provide: CHANNEL_REPOSITORY, useClass: MikroOrmChannelRepository },
    { provide: CHANNEL_DAILY_COUNTER_REPOSITORY, useClass: MikroOrmChannelDailyCounterRepository },
    {
      provide: CHANNEL_QUALITY_SNAPSHOT_REPOSITORY,
      useClass: MikroOrmChannelQualitySnapshotRepository,
    },
    { provide: CHANNEL_SIGNAL_SOURCE, useClass: MikroOrmChannelSignalSource },
    { provide: WEBHOOK_DIAGNOSIS_SOURCE, useClass: MikroOrmWebhookDiagnosisSource },
    CreateChannelUseCase,
    ListChannelsUseCase,
    GetChannelUseCase,
    GetChannelQrCodeUseCase,
    SyncConnectionStateUseCase,
    DiagnoseWebhookUseCase,
    UpdateQuotaBandUseCase,
    DisconnectChannelUseCase,
    RetireChannelUseCase,
    MarkChannelBannedUseCase,
    ReinstateChannelUseCase,
    ReviewChannelQuotaUseCase,
    GetChannelHealthUseCase,
    RegisterSendOutcomeUseCase,
    ApplyConnectionUpdateUseCase,
  ],
  exports: [
    CHANNEL_REPOSITORY,
    CHANNEL_DAILY_COUNTER_REPOSITORY,
    CHANNEL_QUALITY_SNAPSHOT_REPOSITORY,
    CHANNEL_SIGNAL_SOURCE,
    WEBHOOK_DIAGNOSIS_SOURCE,
    ThrottleConfig,
    CreateChannelUseCase,
    ListChannelsUseCase,
    GetChannelUseCase,
    GetChannelQrCodeUseCase,
    SyncConnectionStateUseCase,
    DiagnoseWebhookUseCase,
    UpdateQuotaBandUseCase,
    DisconnectChannelUseCase,
    RetireChannelUseCase,
    MarkChannelBannedUseCase,
    ReinstateChannelUseCase,
    ReviewChannelQuotaUseCase,
    GetChannelHealthUseCase,
    RegisterSendOutcomeUseCase,
    ApplyConnectionUpdateUseCase,
  ],
})
export class ChannelModule {}
