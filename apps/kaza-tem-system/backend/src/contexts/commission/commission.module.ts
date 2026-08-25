import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommissionMapper } from '../../infrastructure/persistence/mikro-orm/mappers/commission.mapper';
import { CommissionOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/commission-orm.entity';
import { CommissionRuleOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/commission-rule-orm.entity';
import {
  COMMISSION_REPOSITORY,
  COMMISSION_RULE_REPOSITORY,
} from './application/ports/output/commission-repository.port';
import {
  MikroOrmCommissionRepository,
  MikroOrmCommissionRuleRepository,
} from '../../infrastructure/persistence/mikro-orm/repositories/commission.repository';
import { CalculateCommissionForOrderUseCase } from './application/use-cases/calculate-commission-for-order/calculate-commission-for-order.use-case';
import { GetResellerBalanceUseCase } from './application/use-cases/get-reseller-balance/get-reseller-balance.use-case';
import { ReleasePendingCommissionsUseCase } from './application/use-cases/release-pending-commissions/release-pending-commissions.use-case';
import { GetCommissionHistoryUseCase } from './application/use-cases/get-commission-history/get-commission-history.use-case';
import { ConfigureCommissionRulesUseCase } from './application/use-cases/configure-commission-rules/configure-commission-rules.use-case';
import { CommissionEventHandlers } from './event-handlers/commission-event-handlers';
import { CommissionController } from '../../infrastructure/http/controllers/commission/commission.controller';
import { AdminCommissionController } from '../../infrastructure/http/controllers/commission/admin-commission.controller';

@Module({
  imports: [MikroOrmModule.forFeature([CommissionOrmEntity, CommissionRuleOrmEntity])],
  providers: [
    CommissionMapper,
    {
      provide: COMMISSION_REPOSITORY,
      useClass: MikroOrmCommissionRepository,
    },
    {
      provide: COMMISSION_RULE_REPOSITORY,
      useClass: MikroOrmCommissionRuleRepository,
    },
    CalculateCommissionForOrderUseCase,
    GetResellerBalanceUseCase,
    ReleasePendingCommissionsUseCase,
    GetCommissionHistoryUseCase,
    ConfigureCommissionRulesUseCase,
    CommissionEventHandlers,
  ],
  controllers: [CommissionController, AdminCommissionController],
  exports: [
    CalculateCommissionForOrderUseCase,
    GetResellerBalanceUseCase,
    ReleasePendingCommissionsUseCase,
    GetCommissionHistoryUseCase,
    ConfigureCommissionRulesUseCase,
    COMMISSION_REPOSITORY,
    COMMISSION_RULE_REPOSITORY,
  ],
})
export class CommissionModule {}
