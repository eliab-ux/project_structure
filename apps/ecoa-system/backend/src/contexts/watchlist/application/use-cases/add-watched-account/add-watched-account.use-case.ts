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
import { WatchedAccount } from '../../../domain/entities/watched-account.entity';
import { Handle } from '../../../domain/value-objects/handle.vo';
import { WatchedAccountAlreadyExistsException } from '../../../domain/exceptions/watched-account-already-exists.exception';
import { WatchedAccountDto } from '../../dto/watched-account.dto';
import { AddWatchedAccountCommand } from './add-watched-account.command';

@Injectable()
export class AddWatchedAccountUseCase implements UseCase<
  AddWatchedAccountCommand,
  WatchedAccountDto
> {
  constructor(
    @Inject(WATCHLIST_REPOSITORY) private readonly watchlistRepository: WatchlistRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: AddWatchedAccountCommand): Promise<WatchedAccountDto> {
    const handle = Handle.create(command.handle);

    const existing = await this.watchlistRepository.findByOwnerAndHandle(
      command.ownerId,
      handle.value,
    );
    if (existing) {
      throw new WatchedAccountAlreadyExistsException(handle.value);
    }

    const account = WatchedAccount.add(command.ownerId, handle);

    return this.uow.execute(async () => {
      const saved = await this.watchlistRepository.save(account);
      return WatchedAccountDto.fromDomain(saved);
    });
  }
}
