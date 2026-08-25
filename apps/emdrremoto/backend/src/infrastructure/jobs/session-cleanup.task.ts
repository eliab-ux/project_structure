import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateRequestContext, MikroORM } from '@mikro-orm/core';
import {
  SESSION_REPOSITORY,
  SessionRepositoryPort,
} from '../../contexts/session/application/ports/output/session-repository.port';
import {
  VIDEO_GATEWAY,
  VideoGatewayPort,
} from '../../contexts/session/application/ports/output/video-gateway.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '../persistence/ports/unit-of-work.port';

const STALE_AFTER_MS = 2 * 60 * 60 * 1000; // 2h

/**
 * Limpeza periódica de sessões antigas ainda ativas: encerra a sessão e remove a sala de
 * vídeo (substitui o cron que rodava em app.ts no sistema legado).
 */
@Injectable()
export class SessionCleanupTask {
  private readonly logger = new Logger(SessionCleanupTask.name);

  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(VIDEO_GATEWAY) private readonly video: VideoGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    // Necessário para o @CreateRequestContext() forkar o EntityManager (cron roda fora de request;
    // acessado via this.orm em runtime pelo decorator; público para o TS não marcar unused).
    readonly orm: MikroORM,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  @CreateRequestContext()
  async cleanupStaleSessions(): Promise<void> {
    const before = new Date(Date.now() - STALE_AFTER_MS);
    const stale = await this.sessions.findStaleActive(before);
    if (stale.length === 0) {
      return;
    }
    this.logger.log(`Limpando ${stale.length} sessão(ões) ociosa(s).`);

    for (const session of stale) {
      const roomName = session.dailyCoName;
      session.end();
      await this.uow.execute(() => this.sessions.save(session));
      if (roomName) {
        await this.video
          .deleteRoom(roomName)
          .catch((error) => this.logger.error('Falha ao remover sala ociosa', { error }));
      }
    }
  }
}
