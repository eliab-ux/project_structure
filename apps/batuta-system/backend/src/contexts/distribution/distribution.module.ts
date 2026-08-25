import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { AccountModule } from '../account/account.module';
import { AudienceModule } from '../audience/audience.module';
import { ChannelModule } from '../channel/channel.module';
import { ContentModule } from '../content/content.module';
import { DistributionConfig } from '../../config/distribution.config';
import {
  DISPATCH_QUEUE,
  DISPATCH_REPOSITORY,
  DISTRIBUTION_REPOSITORY,
} from './application/ports/output/distribution-repositories.port';
import { PlanDistributionUseCase } from './application/use-cases/plan-distribution/plan-distribution.use-case';
import { ConfirmDistributionUseCase } from './application/use-cases/confirm-distribution/confirm-distribution.use-case';
import { ListDistributionsUseCase } from './application/use-cases/list-distributions/list-distributions.use-case';
import { GetDistributionUseCase } from './application/use-cases/get-distribution/get-distribution.use-case';
import { DispatchOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/dispatch-orm.entity';
import { DistributionOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/distribution-orm.entity';
import {
  MikroOrmDispatchRepository,
  MikroOrmDistributionRepository,
} from '../../infrastructure/persistence/mikro-orm/repositories/distribution.repository';
import { BullMqDispatchQueue } from '../../infrastructure/messaging/dispatch-queue.adapter';
import { QUEUE_DISPATCH } from '../../infrastructure/messaging/queues/queues.constants';

/**
 * Distribution planning (FASE 6).
 *
 * It imports four contexts and each one answers a different question the planner cannot answer alone:
 * ContentModule (what is being sent, and is it APPROVED), AudienceModule (to whom), ChannelModule
 * (through which chip, and how much quota is left today), AccountModule (may this tenant send at all,
 * in which timezone, under which ceiling).
 *
 * `DISPATCH_QUEUE` is the real BullMQ producer as of FASE 7. It sits here rather than in
 * MessagingModule because the enqueue belongs to whoever confirms a plan; the worker that consumes it
 * lives on the messaging side.
 */
@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forFeature([DistributionOrmEntity, DispatchOrmEntity]),
    // Producer side of the send queue. The consumer (DispatchProcessor) is registered in
    // MessagingModule; both reference the same queue name.
    BullModule.registerQueue({ name: QUEUE_DISPATCH }),
    ContentModule,
    AudienceModule,
    ChannelModule,
    AccountModule,
  ],
  providers: [
    DistributionConfig,
    { provide: DISTRIBUTION_REPOSITORY, useClass: MikroOrmDistributionRepository },
    { provide: DISPATCH_REPOSITORY, useClass: MikroOrmDispatchRepository },
    { provide: DISPATCH_QUEUE, useClass: BullMqDispatchQueue },
    PlanDistributionUseCase,
    ConfirmDistributionUseCase,
    ListDistributionsUseCase,
    GetDistributionUseCase,
  ],
  exports: [
    DistributionConfig,
    DISTRIBUTION_REPOSITORY,
    DISPATCH_REPOSITORY,
    // Exported for FASE 7: pause/resume/cancel act on the same queue the confirmation filled.
    DISPATCH_QUEUE,
    PlanDistributionUseCase,
    ConfirmDistributionUseCase,
    ListDistributionsUseCase,
    GetDistributionUseCase,
  ],
})
export class DistributionModule {}
