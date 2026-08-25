import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountModule } from '../account/account.module';
import { AudienceModule } from '../audience/audience.module';
import { ChannelModule } from '../channel/channel.module';
import { InboxModule } from '../inbox/inbox.module';
import { ContentModule } from '../content/content.module';
import { DistributionModule } from '../distribution/distribution.module';
import { ThrottleConfig } from '../../config/throttle.config';
import { ExecuteDispatchUseCase } from './application/use-cases/execute-dispatch/execute-dispatch.use-case';
import { PauseDistributionUseCase } from './application/use-cases/pause-distribution/pause-distribution.use-case';
import { ResumeDistributionUseCase } from './application/use-cases/resume-distribution/resume-distribution.use-case';
import { CancelDistributionUseCase } from './application/use-cases/cancel-distribution/cancel-distribution.use-case';
import { RecordDeliveryAckUseCase } from './application/use-cases/record-delivery-ack/record-delivery-ack.use-case';
import { CloseFinishedDistributionsUseCase } from './application/use-cases/sweep-distributions/close-finished-distributions.use-case';

/**
 * Execution (FASE 7).
 *
 * The split from DistributionModule follows §3's context table: `distribution` plans, `dispatch`
 * executes. The domain entities live in the planning context because that is who creates them; this
 * context owns the use cases that act on them at send time.
 *
 * `forwardRef` on DistributionModule is not a smell to hide: the two are genuinely mutually dependent
 * at the module level, because planning needs the queue adapter that execution defines and execution
 * needs the repositories that planning defines. The alternative — moving the repositories to a third
 * module — would add a layer whose only purpose is to avoid a keyword.
 */
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => DistributionModule),
    ChannelModule,
    AudienceModule,
    ContentModule,
    AccountModule,
    // Para o ack de entrega alcançar MESSAGE_REPOSITORY: uma resposta do inbox vive em `messages`, não
    // em `dispatches`, e o ack dela era descartado. Sem ciclo — InboxModule não importa este.
    InboxModule,
  ],
  providers: [
    ThrottleConfig,
    ExecuteDispatchUseCase,
    PauseDistributionUseCase,
    ResumeDistributionUseCase,
    CancelDistributionUseCase,
    RecordDeliveryAckUseCase,
    CloseFinishedDistributionsUseCase,
  ],
  exports: [
    ExecuteDispatchUseCase,
    PauseDistributionUseCase,
    ResumeDistributionUseCase,
    CancelDistributionUseCase,
    RecordDeliveryAckUseCase,
    CloseFinishedDistributionsUseCase,
  ],
})
export class DispatchModule {}
