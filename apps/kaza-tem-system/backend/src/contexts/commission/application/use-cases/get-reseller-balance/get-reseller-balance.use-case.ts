import { Injectable, Inject } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { CommissionBalanceDto } from '../../dto/commission.dto';
import {
  COMMISSION_REPOSITORY,
  CommissionRepositoryPort,
} from '../../ports/output/commission-repository.port';

@Injectable()
export class GetResellerBalanceUseCase implements UseCase<string, CommissionBalanceDto> {
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly repository: CommissionRepositoryPort,
  ) {}

  async execute(resellerId: string): Promise<CommissionBalanceDto> {
    const balance = await this.repository.getBalance(resellerId);
    const total = balance.pending + balance.available + balance.withdrawn - balance.debt;
    return { ...balance, total };
  }
}
