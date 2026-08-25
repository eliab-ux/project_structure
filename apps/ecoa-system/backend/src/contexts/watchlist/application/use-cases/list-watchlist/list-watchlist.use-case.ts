import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  WATCHLIST_REPOSITORY,
  WatchlistRepositoryPort,
} from '../../ports/output/watchlist-repository.port';
import { WatchedAccountDto } from '../../dto/watched-account.dto';
import { ListWatchlistQuery } from './list-watchlist.query';

@Injectable()
export class ListWatchlistUseCase implements UseCase<ListWatchlistQuery, WatchedAccountDto[]> {
  constructor(
    @Inject(WATCHLIST_REPOSITORY) private readonly watchlistRepository: WatchlistRepositoryPort,
  ) {}

  async execute(query: ListWatchlistQuery): Promise<WatchedAccountDto[]> {
    const accounts = await this.watchlistRepository.findByOwner(query.ownerId);
    return accounts.map((account) => WatchedAccountDto.fromDomain(account));
  }
}
