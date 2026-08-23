import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ROUTE_REPOSITORY, RouteRepositoryPort } from '../../ports/output/route-repository.port';
import { RouteDto } from '../../dto/route.dto';

export class ListRoutesQuery {
  constructor(public readonly includeInactive: boolean = false) {}
}

/** Lista as rotas da conta (§2 do 04). */
@Injectable()
export class ListRoutesUseCase implements UseCase<ListRoutesQuery, RouteDto[]> {
  constructor(@Inject(ROUTE_REPOSITORY) private readonly routes: RouteRepositoryPort) {}

  async execute(query: ListRoutesQuery): Promise<RouteDto[]> {
    const routes = await this.routes.list(query.includeInactive);
    return routes.map(RouteDto.fromDomain);
  }
}
