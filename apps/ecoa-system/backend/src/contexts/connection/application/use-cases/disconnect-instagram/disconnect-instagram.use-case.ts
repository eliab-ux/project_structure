import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  CONNECTION_REPOSITORY,
  ConnectionRepositoryPort,
} from '../../ports/output/connection-repository.port';
import { ConnectionNotFoundException } from '../../../domain/exceptions/connection-not-found.exception';

export interface DisconnectInstagramCommand {
  ownerId: string;
}

/**
 * Removes the tenant's connection. Deleting the row frees the ig_user_id (unique-global) so the
 * account can later be connected again — by this tenant or another. Revoking the Instagram link
 * never affects the local login/history.
 */
@Injectable()
export class DisconnectInstagramUseCase implements UseCase<DisconnectInstagramCommand, void> {
  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connectionRepository: ConnectionRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: DisconnectInstagramCommand): Promise<void> {
    const existing = await this.connectionRepository.findByOwner(command.ownerId);
    if (!existing) {
      throw new ConnectionNotFoundException(command.ownerId);
    }
    await this.uow.execute(async () => {
      await this.connectionRepository.delete(command.ownerId);
    });
  }
}
