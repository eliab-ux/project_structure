import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ListMovementsFilter,
  STOCK_MOVEMENT_REPOSITORY,
  StockMovementRepositoryPort,
} from '../../ports/output/stock-movement-repository.port';
import { StockMovementDto } from '../../dto/stock.dto';

export class ListMovementsQuery {
  constructor(public readonly filter: ListMovementsFilter) {}
}

@Injectable()
export class ListMovementsUseCase implements UseCase<ListMovementsQuery, StockMovementDto[]> {
  constructor(
    @Inject(STOCK_MOVEMENT_REPOSITORY) private readonly movements: StockMovementRepositoryPort,
  ) {}

  async execute(query: ListMovementsQuery): Promise<StockMovementDto[]> {
    const rows = await this.movements.list(query.filter);
    return rows.map(StockMovementDto.fromDomain);
  }
}
