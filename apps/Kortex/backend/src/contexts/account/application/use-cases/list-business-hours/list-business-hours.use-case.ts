import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  BUSINESS_HOUR_REPOSITORY,
  BusinessHourRepositoryPort,
} from '../../ports/output/business-hour-repository.port';
import { BusinessHourDto } from '../../dto/business-hour.dto';
import { AccountId } from '../../../domain/value-objects/account-id.vo';

export class ListBusinessHoursQuery {
  constructor(public readonly accountId: string) {}
}

@Injectable()
export class ListBusinessHoursUseCase implements UseCase<
  ListBusinessHoursQuery,
  BusinessHourDto[]
> {
  constructor(
    @Inject(BUSINESS_HOUR_REPOSITORY)
    private readonly businessHourRepository: BusinessHourRepositoryPort,
  ) {}

  async execute(query: ListBusinessHoursQuery): Promise<BusinessHourDto[]> {
    const hours = await this.businessHourRepository.listByAccount(AccountId.from(query.accountId));
    return hours.map(BusinessHourDto.fromDomain);
  }
}
