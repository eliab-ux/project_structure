import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ResellerId } from '@contexts/reseller/domain/value-objects/reseller-id.vo';
import {
  WithdrawalRepositoryPort,
  WITHDRAWAL_REPOSITORY,
} from '../../ports/output/withdrawal-repository.port';
import { ListWithdrawalsQuery } from './list-withdrawals.query';
import { WithdrawalDto } from '../../dto/withdrawal.dto';

@Injectable()
export class ListWithdrawalsUseCase implements UseCase<ListWithdrawalsQuery, WithdrawalDto[]> {
  constructor(
    @Inject(WITHDRAWAL_REPOSITORY)
    private readonly withdrawalRepository: WithdrawalRepositoryPort,
  ) {}

  async execute(query: ListWithdrawalsQuery): Promise<WithdrawalDto[]> {
    const resellerId = ResellerId.from(query.resellerId);
    const list = await this.withdrawalRepository.findByReseller(resellerId);
    return list.map((withdrawal) => WithdrawalDto.fromDomain(withdrawal));
  }
}
