import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  FINANCIAL_TITLE_REPOSITORY,
  FinancialTitleRepositoryPort,
} from '../../ports/output/financial-title-repository.port';
import { TitleDirection } from '../../../domain/title-enums';
import { FinancialTitleDto } from '../../dto/finance.dto';

export class ListFinancialTitlesQuery {
  constructor(
    public readonly direction: TitleDirection,
    public readonly filter: {
      companyId?: string | null;
      contactId?: string | null;
      status?: string | null;
    } = {},
  ) {}
}

/** Lista os títulos de uma direção (a receber / a pagar), §2.1/§2.2 do 05. */
@Injectable()
export class ListFinancialTitlesUseCase implements UseCase<
  ListFinancialTitlesQuery,
  FinancialTitleDto[]
> {
  constructor(
    @Inject(FINANCIAL_TITLE_REPOSITORY) private readonly titles: FinancialTitleRepositoryPort,
  ) {}

  async execute(query: ListFinancialTitlesQuery): Promise<FinancialTitleDto[]> {
    const titles = await this.titles.list({
      direction: query.direction,
      companyId: query.filter.companyId ?? null,
      contactId: query.filter.contactId ?? null,
      status: query.filter.status ?? null,
    });
    return titles.map(FinancialTitleDto.fromDomain);
  }
}
