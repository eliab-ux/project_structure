import { Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ListPendingResellersQuery } from './list-pending-resellers.query';
import { AdminResellerDto } from '../../dto/admin-reseller.dto';
import { ResellerReportingRepository } from '@contexts/reseller/infrastructure/reseller-reporting.repository';

@Injectable()
export class ListPendingResellersUseCase implements UseCase<
  ListPendingResellersQuery,
  AdminResellerDto[]
> {
  constructor(private readonly reportingRepository: ResellerReportingRepository) {}

  async execute(query: ListPendingResellersQuery): Promise<AdminResellerDto[]> {
    const { items } = await this.reportingRepository.list({
      status: ['pending'],
      limit: query.limit,
      offset: query.offset,
    });

    return items.map(AdminResellerDto.fromRow);
  }
}
