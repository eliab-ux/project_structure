import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult, UseCase } from '@gitspread/shared-kernel';
import { DispatchLogDto } from '../../dto/dispatch-log.dto';
import {
  DISPATCH_LOG_REPOSITORY,
  DispatchLogRepositoryPort,
} from '../../ports/output/dispatch-log-repository.port';

export interface ListDispatchHistoryCommand {
  userId: string;
  page: number;
  limit: number;
}

@Injectable()
export class ListDispatchHistoryUseCase implements UseCase<
  ListDispatchHistoryCommand,
  PaginatedResult<DispatchLogDto>
> {
  constructor(@Inject(DISPATCH_LOG_REPOSITORY) private readonly logs: DispatchLogRepositoryPort) {}

  /** Só os envios DESTE usuário — o `userId` vem do token. */
  async execute(command: ListDispatchHistoryCommand): Promise<PaginatedResult<DispatchLogDto>> {
    const result = await this.logs.listByUser(command.userId, {
      page: command.page,
      limit: command.limit,
    });
    return { data: result.data.map((log) => DispatchLogDto.fromDomain(log)), meta: result.meta };
  }
}
