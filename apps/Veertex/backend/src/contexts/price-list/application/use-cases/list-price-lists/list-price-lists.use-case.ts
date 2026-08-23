import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PRICE_LIST_REPOSITORY,
  PriceListRepositoryPort,
} from '../../ports/output/price-list-repository.port';
import { PriceListDto } from '../../dto/price-list.dto';

export class ListPriceListsQuery {
  constructor(public readonly includeInactive: boolean = false) {}
}

/** Lista as tabelas de preço da conta (§3.2 do 02A). */
@Injectable()
export class ListPriceListsUseCase implements UseCase<ListPriceListsQuery, PriceListDto[]> {
  constructor(
    @Inject(PRICE_LIST_REPOSITORY) private readonly priceLists: PriceListRepositoryPort,
  ) {}

  async execute(query: ListPriceListsQuery): Promise<PriceListDto[]> {
    const lists = await this.priceLists.list(query.includeInactive);
    return lists.map((list) => PriceListDto.fromDomain(list));
  }
}
