import { Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ListResellersQuery } from './list-resellers.query';
import { AdminResellerDto } from '../../dto/admin-reseller.dto';
import { ListResellersResult } from './list-resellers.result';
import { ResellerReportingRepository } from '@contexts/reseller/infrastructure/reseller-reporting.repository';

@Injectable()
export class ListResellersUseCase implements UseCase<ListResellersQuery, ListResellersResult> {
  constructor(private readonly reportingRepository: ResellerReportingRepository) {}

  async execute(query: ListResellersQuery): Promise<ListResellersResult> {
    const statuses = query.status
      ? query.status
          .split(',')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : undefined;

    const { total, items } = await this.reportingRepository.list({
      status: statuses,
      level: query.level,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      total,
      items: items.map(AdminResellerDto.fromRow),
    };
  }
}
