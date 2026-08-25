import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  WithdrawalRepositoryPort,
  WITHDRAWAL_REPOSITORY,
} from '../../ports/output/withdrawal-repository.port';
import { RejectWithdrawalCommand } from './reject-withdrawal.command';
import { WithdrawalDto } from '../../dto/withdrawal.dto';
import { WithdrawalNotFoundException } from '../../../domain/exceptions/withdrawal-not-found.exception';
import { UnitOfWorkPort, UNIT_OF_WORK } from '@infrastructure/persistence/ports/unit-of-work.port';
import { WithdrawalId } from '../../../domain/value-objects/withdrawal-id.vo';

@Injectable()
export class RejectWithdrawalUseCase implements UseCase<RejectWithdrawalCommand, WithdrawalDto> {
  constructor(
    @Inject(WITHDRAWAL_REPOSITORY)
    private readonly withdrawalRepository: WithdrawalRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(command: RejectWithdrawalCommand): Promise<WithdrawalDto> {
    const withdrawal = await this.withdrawalRepository.findById(
      WithdrawalId.from(command.withdrawalId),
    );
    if (!withdrawal) {
      throw new WithdrawalNotFoundException(command.withdrawalId);
    }

    withdrawal.reject(command.reason);

    return this.unitOfWork.execute(async () => {
      const saved = await this.withdrawalRepository.save(withdrawal);
      return WithdrawalDto.fromDomain(saved);
    });
  }
}
