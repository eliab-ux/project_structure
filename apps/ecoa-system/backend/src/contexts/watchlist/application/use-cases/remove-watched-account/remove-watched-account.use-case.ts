import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  WATCHLIST_REPOSITORY,
  WatchlistRepositoryPort,
} from '../../ports/output/watchlist-repository.port';
import { WatchedAccountNotFoundException } from '../../../domain/exceptions/watched-account-not-found.exception';
import { RemoveWatchedAccountCommand } from './remove-watched-account.command';

@Injectable()
export class RemoveWatchedAccountUseCase implements UseCase<RemoveWatchedAccountCommand, void> {
  constructor(
    @Inject(WATCHLIST_REPOSITORY) private readonly watchlistRepository: WatchlistRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RemoveWatchedAccountCommand): Promise<void> {
    const account = await this.watchlistRepository.findById(command.ownerId, command.id);
    if (!account) {
      throw new WatchedAccountNotFoundException(command.id);
    }

    await this.uow.execute(async () => {
      await this.watchlistRepository.delete(command.ownerId, command.id);
    });
  }
}
