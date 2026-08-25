import { forwardRef, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WithdrawalMapper } from '../../infrastructure/persistence/mikro-orm/mappers/withdrawal.mapper';
import { WithdrawalOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/withdrawal-orm.entity';
import { WITHDRAWAL_REPOSITORY } from './application/ports/output/withdrawal-repository.port';
import { MikroOrmWithdrawalRepository } from '../../infrastructure/persistence/mikro-orm/repositories/withdrawal.repository';
import { RequestWithdrawalUseCase } from './application/use-cases/request-withdrawal/request-withdrawal.use-case';
import { ApproveWithdrawalUseCase } from './application/use-cases/approve-withdrawal/approve-withdrawal.use-case';
import { RejectWithdrawalUseCase } from './application/use-cases/reject-withdrawal/reject-withdrawal.use-case';
import { MarkWithdrawalPaidUseCase } from './application/use-cases/mark-paid/mark-paid.use-case';
import { ListWithdrawalsUseCase } from './application/use-cases/list-withdrawals/list-withdrawals.use-case';
import { CommissionModule } from '@contexts/commission/commission.module';
import { ResellerModule } from '@contexts/reseller/reseller.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([WithdrawalOrmEntity]),
    CommissionModule,
    forwardRef(() => ResellerModule),
  ],
  providers: [
    WithdrawalMapper,
    {
      provide: WITHDRAWAL_REPOSITORY,
      useClass: MikroOrmWithdrawalRepository,
    },
    RequestWithdrawalUseCase,
    ApproveWithdrawalUseCase,
    RejectWithdrawalUseCase,
    MarkWithdrawalPaidUseCase,
    ListWithdrawalsUseCase,
  ],
  exports: [
    RequestWithdrawalUseCase,
    ApproveWithdrawalUseCase,
    RejectWithdrawalUseCase,
    MarkWithdrawalPaidUseCase,
    ListWithdrawalsUseCase,
    WITHDRAWAL_REPOSITORY,
  ],
})
export class WithdrawalModule {}
