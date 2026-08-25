import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  COMMISSION_REPOSITORY,
  CommissionRepositoryPort,
} from '../../ports/output/commission-repository.port';
import { CommissionDto } from '../../dto/commission.dto';
import { GetCommissionHistoryQuery } from './get-commission-history.query';

@Injectable()
export class GetCommissionHistoryUseCase implements UseCase<
  GetCommissionHistoryQuery,
  CommissionDto[]
> {
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
  ) {}

  async execute(query: GetCommissionHistoryQuery): Promise<CommissionDto[]> {
    const commissions = await this.commissionRepository.findByResellerId(query.resellerId, {
      limit: query.limit,
      offset: query.offset,
    });
    return commissions.map(CommissionDto.fromDomain);
  }
}
