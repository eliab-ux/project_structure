import { forwardRef, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ResellerOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/reseller-orm.entity';
import { RESELLER_REPOSITORY } from './application/ports/output/reseller-repository.port';
import { MikroOrmResellerRepository } from '../../infrastructure/persistence/mikro-orm/repositories/reseller.repository';
import { ResellerMapper } from '../../infrastructure/persistence/mikro-orm/mappers/reseller.mapper';
import { RegisterResellerUseCase } from './application/use-cases/register-reseller/register-reseller.use-case';
import { ApproveResellerRegistrationUseCase } from './application/use-cases/approve-reseller/approve-reseller.use-case';
import { ListPendingResellersUseCase } from './application/use-cases/list-pending-resellers/list-pending-resellers.use-case';
import { ListResellersUseCase } from './application/use-cases/list-resellers/list-resellers.use-case';
import { RejectResellerUseCase } from './application/use-cases/reject-reseller/reject-reseller.use-case';
import { GetResellerProfileUseCase } from './application/use-cases/get-profile/get-profile.use-case';
import { UpdateResellerProfileUseCase } from './application/use-cases/update-profile/update-profile.use-case';
import { UpdateResellerBankInfoUseCase } from './application/use-cases/update-bank-info/update-bank-info.use-case';
import { SuspendResellerUseCase } from './application/use-cases/suspend-reseller/suspend-reseller.use-case';
import { ReactivateResellerUseCase } from './application/use-cases/reactivate-reseller/reactivate-reseller.use-case';
import { ResellerReportingRepository } from '@contexts/reseller/infrastructure/reseller-reporting.repository';
import { UserModule } from '../user/user.module';
import { CommissionModule } from '../commission/commission.module';
import { OrderModule } from '../order/order.module';
import { AnalyticsModule } from '@contexts/analytics/analytics.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { GetResellerDashboardUseCase } from './application/use-cases/get-dashboard/get-reseller-dashboard.use-case';
import { GetAdminResellerDetailUseCase } from './application/use-cases/get-admin-reseller-detail/get-admin-reseller-detail.use-case';
import { ResellerEmailEventHandlers } from './event-handlers/reseller-email.event-handlers';
import { WithdrawalModule } from '../withdrawal/withdrawal.module';
import { CieloModule } from '@infrastructure/integrations/cielo/cielo.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([ResellerOrmEntity]),
    UserModule,
    CommissionModule,
    forwardRef(() => OrderModule),
    AnalyticsModule,
    forwardRef(() => SubscriptionModule),
    forwardRef(() => WithdrawalModule),
    forwardRef(() => CieloModule),
  ],
  providers: [
    ResellerMapper,
    {
      provide: RESELLER_REPOSITORY,
      useClass: MikroOrmResellerRepository,
    },
    ResellerReportingRepository,
    RegisterResellerUseCase,
    ApproveResellerRegistrationUseCase,
    ListPendingResellersUseCase,
    ListResellersUseCase,
    RejectResellerUseCase,
    GetResellerDashboardUseCase,
    GetAdminResellerDetailUseCase,
    SuspendResellerUseCase,
    ReactivateResellerUseCase,
    GetResellerProfileUseCase,
    UpdateResellerProfileUseCase,
    UpdateResellerBankInfoUseCase,
    ResellerEmailEventHandlers,
  ],
  exports: [
    RESELLER_REPOSITORY,
    RegisterResellerUseCase,
    ApproveResellerRegistrationUseCase,
    ListPendingResellersUseCase,
    ListResellersUseCase,
    RejectResellerUseCase,
    GetResellerDashboardUseCase,
    SuspendResellerUseCase,
    ReactivateResellerUseCase,
    GetResellerProfileUseCase,
    UpdateResellerProfileUseCase,
    UpdateResellerBankInfoUseCase,
    GetAdminResellerDetailUseCase,
  ],
})
export class ResellerModule {}
