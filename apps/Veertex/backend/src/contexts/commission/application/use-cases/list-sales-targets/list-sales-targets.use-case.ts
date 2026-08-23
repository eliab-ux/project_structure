import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SALES_TARGET_REPOSITORY,
  SalesTargetRepositoryPort,
} from '../../ports/output/sales-target-repository.port';
import { SalesTargetDto } from '../../dto/commission.dto';

export class ListSalesTargetsQuery {
  constructor(public readonly period: string) {}
}

/** Metas de um período (§2 do 02A) — a tela de metas por vendedor. */
@Injectable()
export class ListSalesTargetsUseCase implements UseCase<ListSalesTargetsQuery, SalesTargetDto[]> {
  constructor(
    @Inject(SALES_TARGET_REPOSITORY) private readonly targets: SalesTargetRepositoryPort,
  ) {}

  async execute(query: ListSalesTargetsQuery): Promise<SalesTargetDto[]> {
    const targets = await this.targets.listByPeriod(query.period);
    return targets.map(SalesTargetDto.fromDomain);
  }
}
