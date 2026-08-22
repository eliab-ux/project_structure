import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  STOCK_LOCATION_REPOSITORY,
  StockLocationRepositoryPort,
} from '../../ports/output/stock-location-repository.port';
import { StockLocationDto } from '../../dto/stock.dto';

export class ListStockLocationsQuery {
  constructor(public readonly companyId: string) {}
}

/** Localizações de uma empresa (§2 do 03A) — para o seletor de local no registro/transferência. */
@Injectable()
export class ListStockLocationsUseCase implements UseCase<
  ListStockLocationsQuery,
  StockLocationDto[]
> {
  constructor(
    @Inject(STOCK_LOCATION_REPOSITORY) private readonly locations: StockLocationRepositoryPort,
  ) {}

  async execute(query: ListStockLocationsQuery): Promise<StockLocationDto[]> {
    const locations = await this.locations.listByCompany(query.companyId);
    return locations.map((location) => StockLocationDto.fromDomain(location));
  }
}
