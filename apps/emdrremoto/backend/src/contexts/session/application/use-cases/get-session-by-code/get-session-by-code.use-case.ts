import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../ports/output/session-repository.port';
import { SessionDto } from '../../dto/session.dto';
import { SessionNotFoundException } from '../../../domain/exceptions/session.exceptions';

export class GetSessionByCodeQuery {
  constructor(public readonly sessionCode: string) {}
}

@Injectable()
export class GetSessionByCodeUseCase implements UseCase<GetSessionByCodeQuery, SessionDto> {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort) {}

  async execute(query: GetSessionByCodeQuery): Promise<SessionDto> {
    const session = await this.sessions.findByCode(query.sessionCode);
    if (!session) {
      throw new SessionNotFoundException(query.sessionCode);
    }
    return SessionDto.fromDomain(session);
  }
}
