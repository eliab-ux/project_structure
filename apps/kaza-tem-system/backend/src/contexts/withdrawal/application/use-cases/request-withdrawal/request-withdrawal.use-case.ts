import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CommissionRepositoryPort,
  COMMISSION_REPOSITORY,
} from '@contexts/commission/application/ports/output/commission-repository.port';
import {
  ResellerRepositoryPort,
  RESELLER_REPOSITORY,
} from '@contexts/reseller/application/ports/output/reseller-repository.port';
import { ResellerId } from '@contexts/reseller/domain/value-objects/reseller-id.vo';
import { UnitOfWorkPort, UNIT_OF_WORK } from '@infrastructure/persistence/ports/unit-of-work.port';
import {
  WithdrawalRepositoryPort,
  WITHDRAWAL_REPOSITORY,
} from '../../ports/output/withdrawal-repository.port';
import { RequestWithdrawalCommand } from './request-withdrawal.command';
import { WithdrawalDto } from '../../dto/withdrawal.dto';
import { Withdrawal } from '../../../domain/entities/withdrawal.entity';
import { PendingWithdrawalExistsException } from '../../../domain/exceptions/pending-withdrawal-exists.exception';
import { InsufficientBalanceException } from '../../../domain/exceptions/insufficient-balance.exception';
import { ResellerNotFoundException } from '@contexts/reseller/domain/exceptions/reseller-not-found.exception';

@Injectable()
export class RequestWithdrawalUseCase implements UseCase<RequestWithdrawalCommand, WithdrawalDto> {
  constructor(
    @Inject(WITHDRAWAL_REPOSITORY)
    private readonly withdrawalRepository: WithdrawalRepositoryPort,
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: RequestWithdrawalCommand): Promise<WithdrawalDto> {
    const resellerId = ResellerId.from(command.resellerId);
    const reseller = await this.resellerRepository.findById(resellerId);
    if (!reseller) {
      throw new ResellerNotFoundException(command.resellerId);
    }

    const hasPending = await this.withdrawalRepository.hasPendingWithdrawal(resellerId);
    if (hasPending) {
      throw new PendingWithdrawalExistsException();
    }

    const availableCommissions = await this.commissionRepository.findAvailableByReseller(
      resellerId.value,
    );
    const totalAvailable = availableCommissions.reduce(
      (sum, commission) => sum + commission.amount,
      0,
    );
    if (totalAvailable < 50) {
      throw new InsufficientBalanceException('Minimum withdrawal amount is R$ 50.00');
    }

    const withdrawal = Withdrawal.create(
      resellerId,
      totalAvailable,
      availableCommissions.map((commission) => commission.id),
      command.bankData,
    );

    return this.unitOfWork.execute(async () => {
      const saved = await this.withdrawalRepository.save(withdrawal);
      return WithdrawalDto.fromDomain(saved);
    });
  }
}
