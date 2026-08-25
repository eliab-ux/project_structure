import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../ports/output/session-repository.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { SessionRole } from '../../../domain/entities/session.entity';
import {
  SessionNotFoundException,
  SessionUnauthorizedException,
} from '../../../domain/exceptions/session.exceptions';

export class RecordEntryCommand {
  constructor(
    public readonly userId: string,
    public readonly role: SessionRole,
    public readonly sessionCode: string,
  ) {}
}

@Injectable()
export class RecordEntryUseCase implements UseCase<RecordEntryCommand, void> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RecordEntryCommand): Promise<void> {
    const session = await this.sessions.findByCode(command.sessionCode);
    if (!session) {
      throw new SessionNotFoundException(command.sessionCode);
    }
    if (!session.isMember(command.userId, command.role)) {
      throw new SessionUnauthorizedException();
    }
    session.registerEntry(command.role);
    await this.uow.execute(() => this.sessions.save(session));
  }
}
