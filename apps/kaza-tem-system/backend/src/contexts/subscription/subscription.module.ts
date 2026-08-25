import { forwardRef, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SubscriptionOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/subscription-orm.entity';
import { SUBSCRIPTION_REPOSITORY } from './application/ports/output/subscription-repository.port';
import { MikroOrmSubscriptionRepository } from '@infrastructure/persistence/mikro-orm/repositories/subscription.repository';
import { SubscriptionMapper } from '@infrastructure/persistence/mikro-orm/mappers/subscription.mapper';
import { CreateSubscriptionUseCase } from './application/use-cases/create-subscription/create-subscription.use-case';
import { ProcessPaymentWebhookUseCase } from './application/use-cases/process-payment-webhook/process-payment-webhook.use-case';
import { CancelSubscriptionUseCase } from './application/use-cases/cancel-subscription/cancel-subscription.use-case';
import { GetSubscriptionUseCase } from './application/use-cases/get-subscription/get-subscription.use-case';
import { CieloModule } from '@infrastructure/integrations/cielo/cielo.module';
import { ResellerModule } from '@contexts/reseller/reseller.module';
import { UserModule } from '@contexts/user/user.module';
import { SubscriptionEmailEventHandlers } from './event-handlers/subscription-email.event-handlers';
import { EmailService } from '@infrastructure/messaging/email/email.service';
import { CheckSuspendedSubscriptionsJob } from '@infrastructure/jobs/check-suspended-subscriptions.job';

@Module({
  imports: [
    MikroOrmModule.forFeature([SubscriptionOrmEntity]),
    forwardRef(() => CieloModule),
    forwardRef(() => ResellerModule),
    UserModule,
  ],
  providers: [
    SubscriptionMapper,
    EmailService,
    SubscriptionEmailEventHandlers,
    CheckSuspendedSubscriptionsJob,
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: MikroOrmSubscriptionRepository,
    },
    CreateSubscriptionUseCase,
    ProcessPaymentWebhookUseCase,
    CancelSubscriptionUseCase,
    GetSubscriptionUseCase,
  ],
  exports: [
    CreateSubscriptionUseCase,
    ProcessPaymentWebhookUseCase,
    CancelSubscriptionUseCase,
    GetSubscriptionUseCase,
    EmailService,
    SUBSCRIPTION_REPOSITORY,
  ],
})
export class SubscriptionModule {}
