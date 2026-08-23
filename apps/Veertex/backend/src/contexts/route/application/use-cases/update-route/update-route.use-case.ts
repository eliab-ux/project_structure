import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { ROUTE_REPOSITORY, RouteRepositoryPort } from '../../ports/output/route-repository.port';
import { RouteDto } from '../../dto/route.dto';
import { RouteNotFoundException } from '../../../domain/exceptions/route-exceptions';

export class UpdateRouteCommand {
  constructor(
    public readonly id: string,
    public readonly input: {
      name?: string;
      code?: string | null;
      cycleDays?: number | null;
      active?: boolean;
    },
  ) {}
}

/** Edita/desativa uma rota (§2 do 04). `findById` isola por tenant. */
@Injectable()
export class UpdateRouteUseCase implements UseCase<UpdateRouteCommand, RouteDto> {
  constructor(
    @Inject(ROUTE_REPOSITORY) private readonly routes: RouteRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: UpdateRouteCommand): Promise<RouteDto> {
    return this.uow.execute(async () => {
      const route = await this.routes.findById(command.id);
      if (!route) {
        throw new RouteNotFoundException();
      }
      route.edit(command.input);
      const saved = await this.routes.save(route);
      return RouteDto.fromDomain(saved);
    });
  }
}
