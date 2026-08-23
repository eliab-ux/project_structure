import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { ROUTE_REPOSITORY, RouteRepositoryPort } from '../../ports/output/route-repository.port';
import { Route } from '../../../domain/entities/route.entity';
import { RouteDto } from '../../dto/route.dto';

export class CreateRouteCommand {
  constructor(
    public readonly accountId: string,
    public readonly name: string,
    public readonly code?: string | null,
  ) {}
}

/** Cadastra uma rota (§2 do 04). */
@Injectable()
export class CreateRouteUseCase implements UseCase<CreateRouteCommand, RouteDto> {
  constructor(
    @Inject(ROUTE_REPOSITORY) private readonly routes: RouteRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CreateRouteCommand): Promise<RouteDto> {
    const route = Route.create({
      accountId: command.accountId,
      name: command.name,
      code: command.code ?? null,
    });
    return this.uow.execute(async () => {
      const saved = await this.routes.save(route);
      return RouteDto.fromDomain(saved);
    });
  }
}
