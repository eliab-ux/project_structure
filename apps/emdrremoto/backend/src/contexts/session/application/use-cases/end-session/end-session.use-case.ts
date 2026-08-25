import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../ports/output/session-repository.port';
import { VIDEO_GATEWAY, VideoGatewayPort } from '../../ports/output/video-gateway.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { SessionRole } from '../../../domain/entities/session.entity';
import {
  SessionNotFoundException,
  SessionUnauthorizedException,
} from '../../../domain/exceptions/session.exceptions';

export class EndSessionCommand {
  constructor(
    public readonly userId: string,
    public readonly role: SessionRole,
    public readonly sessionCode: string,
  ) {}
}

@Injectable()
export class EndSessionUseCase implements UseCase<EndSessionCommand, void> {
  private readonly logger = new Logger(EndSessionUseCase.name);

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(VIDEO_GATEWAY) private readonly video: VideoGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: EndSessionCommand): Promise<void> {
    const session = await this.sessions.findByCode(command.sessionCode);
    if (!session) {
      throw new SessionNotFoundException(command.sessionCode);
    }
    if (!session.isMember(command.userId, command.role)) {
      throw new SessionUnauthorizedException();
    }

    const roomName = session.dailyCoName;
    session.end();
    await this.uow.execute(() => this.sessions.save(session));

    if (roomName) {
      // Limpeza da sala de vídeo — falha aqui não deve reverter o encerramento persistido.
      this.video
        .deleteRoom(roomName)
        .catch((error) => this.logger.error('Falha ao remover sala de vídeo', { error }));
    }
  }
}
