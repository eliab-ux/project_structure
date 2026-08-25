import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  WithdrawalRepositoryPort,
  WITHDRAWAL_REPOSITORY,
} from '../../ports/output/withdrawal-repository.port';
import { ApproveWithdrawalCommand } from './approve-withdrawal.command';
import { WithdrawalDto } from '../../dto/withdrawal.dto';
import { WithdrawalNotFoundException } from '../../../domain/exceptions/withdrawal-not-found.exception';
import {
  CommissionRepositoryPort,
  COMMISSION_REPOSITORY,
} from '@contexts/commission/application/ports/output/commission-repository.port';
import { UnitOfWorkPort, UNIT_OF_WORK } from '@infrastructure/persistence/ports/unit-of-work.port';
import { WithdrawalId } from '../../../domain/value-objects/withdrawal-id.vo';

@Injectable()
export class ApproveWithdrawalUseCase implements UseCase<ApproveWithdrawalCommand, WithdrawalDto> {
  constructor(
    @Inject(WITHDRAWAL_REPOSITORY)
    private readonly withdrawalRepository: WithdrawalRepositoryPort,
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: ApproveWithdrawalCommand): Promise<WithdrawalDto> {
    const withdrawal = await this.withdrawalRepository.findById(
      WithdrawalId.from(command.withdrawalId),
    );
    if (!withdrawal) {
      throw new WithdrawalNotFoundException(command.withdrawalId);
    }

    withdrawal.approve(command.adminId);

    const commissionIds = withdrawal.commissionIds.map((id) => id.value);
    const commissions = await this.commissionRepository.findByIds(commissionIds);

    return this.unitOfWork.execute(async () => {
      for (const commission of commissions) {
        commission.markAsWithdrawn(withdrawal.id.value);
        await this.commissionRepository.save(commission);
      }
      const saved = await this.withdrawalRepository.save(withdrawal);
      return WithdrawalDto.fromDomain(saved);
    });
  }
}
