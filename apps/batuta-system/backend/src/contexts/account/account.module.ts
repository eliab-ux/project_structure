import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ACCOUNT_REPOSITORY } from './application/ports/output/account-repository.port';
import { DAILY_SEND_USAGE } from './application/ports/output/daily-send-usage.port';
import { GetCurrentAccountUseCase } from './application/use-cases/get-current-account/get-current-account.use-case';
import { EnsureAccountCanDispatchUseCase } from './application/use-cases/ensure-account-can-dispatch/ensure-account-can-dispatch.use-case';
import { AccountOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/account-orm.entity';
import { AccountMapper } from '../../infrastructure/persistence/mikro-orm/mappers/account.mapper';
import { MikroOrmAccountRepository } from '../../infrastructure/persistence/mikro-orm/repositories/account.repository';
import { MikroOrmDailySendUsage } from '../../infrastructure/persistence/daily-send-usage.adapter';

@Module({
  imports: [MikroOrmModule.forFeature([AccountOrmEntity])],
  providers: [
    AccountMapper,
    { provide: ACCOUNT_REPOSITORY, useClass: MikroOrmAccountRepository },
    // FASE 2: reads channel_daily_counters, the source of truth for quota (§4). Registered here
    // rather than in ChannelModule because the PORT belongs to the account context (the ceiling is
    // an account rule); the channel context owns the table it reads.
    { provide: DAILY_SEND_USAGE, useClass: MikroOrmDailySendUsage },
    GetCurrentAccountUseCase,
    EnsureAccountCanDispatchUseCase,
  ],
  exports: [
    ACCOUNT_REPOSITORY,
    DAILY_SEND_USAGE,
    GetCurrentAccountUseCase,
    EnsureAccountCanDispatchUseCase,
  ],
})
export class AccountModule {}
