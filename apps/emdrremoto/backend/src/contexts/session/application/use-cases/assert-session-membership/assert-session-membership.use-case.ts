import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../ports/output/session-repository.port';
import { Session, SessionRole } from '../../../domain/entities/session.entity';
import {
  SessionNotFoundException,
  SessionUnauthorizedException,
} from '../../../domain/exceptions/session.exceptions';

export class AssertSessionMembershipQuery {
  constructor(
    public readonly userId: string,
    public readonly role: SessionRole,
    public readonly sessionCode: string,
  ) {}
}

/**
 * Autorização contextual reutilizada pelo HTTP e pelo Real-time Gateway: garante que o
 * usuário autenticado pertence à sessão antes de qualquer entrada/emit (menor privilégio).
 */
@Injectable()
export class AssertSessionMembershipUseCase implements UseCase<
  AssertSessionMembershipQuery,
  Session
> {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort) {}

  async execute(query: AssertSessionMembershipQuery): Promise<Session> {
    const session = await this.sessions.findByCode(query.sessionCode);
    if (!session) {
      throw new SessionNotFoundException(query.sessionCode);
    }
    if (!session.isMember(query.userId, query.role)) {
      throw new SessionUnauthorizedException();
    }
    return session;
  }
}
