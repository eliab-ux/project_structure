import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { WatchedAccountOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/watched-account-orm.entity';
import { WatchedAccountMapper } from '../../infrastructure/persistence/mikro-orm/mappers/watched-account.mapper';
import { MikroOrmWatchlistRepository } from '../../infrastructure/persistence/mikro-orm/repositories/watchlist.repository';
import { WATCHLIST_REPOSITORY } from './application/ports/output/watchlist-repository.port';
import { AddWatchedAccountUseCase } from './application/use-cases/add-watched-account/add-watched-account.use-case';
import { RemoveWatchedAccountUseCase } from './application/use-cases/remove-watched-account/remove-watched-account.use-case';
import { ListWatchlistUseCase } from './application/use-cases/list-watchlist/list-watchlist.use-case';
import { ResolveWatchlistUseCase } from './application/use-cases/resolve-watchlist/resolve-watchlist.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([WatchedAccountOrmEntity])],
  providers: [
    WatchedAccountMapper,
    { provide: WATCHLIST_REPOSITORY, useClass: MikroOrmWatchlistRepository },
    AddWatchedAccountUseCase,
    RemoveWatchedAccountUseCase,
    ListWatchlistUseCase,
    ResolveWatchlistUseCase,
  ],
  exports: [
    WATCHLIST_REPOSITORY,
    AddWatchedAccountUseCase,
    RemoveWatchedAccountUseCase,
    ListWatchlistUseCase,
    ResolveWatchlistUseCase,
  ],
})
export class WatchlistModule {}
