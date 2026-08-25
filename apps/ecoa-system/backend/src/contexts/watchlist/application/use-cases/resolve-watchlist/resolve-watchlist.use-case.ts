import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  INSTAGRAM_GATEWAY,
  InstagramGatewayPort,
} from '../../../../../infrastructure/integrations/instagram/ports/instagram-gateway.port';
import {
  WATCHLIST_REPOSITORY,
  WatchlistRepositoryPort,
} from '../../ports/output/watchlist-repository.port';
import { ResolveWatchlistCommand } from './resolve-watchlist.command';

export interface ResolveWatchlistResult {
  resolved: number;
}

@Injectable()
export class ResolveWatchlistUseCase implements UseCase<
  ResolveWatchlistCommand,
  ResolveWatchlistResult
> {
  private readonly logger = new Logger(ResolveWatchlistUseCase.name);

  constructor(
    @Inject(WATCHLIST_REPOSITORY) private readonly watchlistRepository: WatchlistRepositoryPort,
    @Inject(INSTAGRAM_GATEWAY) private readonly instagramGateway: InstagramGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: ResolveWatchlistCommand): Promise<ResolveWatchlistResult> {
    const pending = await this.watchlistRepository.findUnresolvedByOwner(command.ownerId);

    let resolved = 0;
    for (const account of pending) {
      try {
        const igUserId = await this.instagramGateway.resolveHandle(
          account.handle.value,
          command.accessToken,
        );
        if (igUserId == null) {
          continue;
        }
        account.resolve(igUserId);
        await this.uow.execute(async () => {
          await this.watchlistRepository.save(account);
        });
        resolved += 1;
      } catch (error) {
        // Tolerate per-item failure: one handle that cannot be resolved must not abort the batch.
        this.logger.warn('Falha ao resolver conta monitorada', {
          ownerId: command.ownerId,
          handle: account.handle.value,
          error,
        });
      }
    }

    return { resolved };
  }
}
