import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { validate } from './config/env.validation';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { HttpModule } from './infrastructure/http/http.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { OrderModule } from './contexts/order/order.module';
import { CommissionModule } from './contexts/commission/commission.module';
import { WithdrawalModule } from './contexts/withdrawal/withdrawal.module';
import { SubscriptionModule } from './contexts/subscription/subscription.module';

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
      maxListeners: 10,
    }),
    ScheduleModule.forRoot(),
    PersistenceModule,
    HttpModule,
    SecurityModule,
    OrderModule,
    CommissionModule,
    WithdrawalModule,
    SubscriptionModule,
  ],
})
export class AppModule {}
