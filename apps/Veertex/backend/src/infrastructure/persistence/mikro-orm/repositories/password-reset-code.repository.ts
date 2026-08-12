import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PasswordResetCodeRepositoryPort } from '../../../../contexts/auth/application/ports/output/password-reset-code-repository.port';
import { PasswordResetCode } from '../../../../contexts/auth/domain/entities/password-reset-code.entity';
import { PasswordResetCodeOrmEntity } from '../entities/password-reset-code-orm.entity';

@Injectable()
export class MikroOrmPasswordResetCodeRepository implements PasswordResetCodeRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async findLiveByUser(userId: string, now: Date): Promise<PasswordResetCode | null> {
    const orm = await this.em.findOne(
      PasswordResetCodeOrmEntity,
      { userId, consumedAt: null, expiresAt: { $gt: now } },
      // Newest first: only one should ever be live, but if a race left two, the fresher one is the
      // code the user is actually holding.
      { orderBy: { createdAt: 'DESC' } },
    );
    return orm ? this.toDomain(orm) : null;
  }

  async countSentSince(userId: string, since: Date): Promise<number> {
    // `sentAt` — not `createdAt`: the quota counts messages that actually reached the user, so a
    // gateway outage cannot consume their ability to recover the account.
    return this.em.count(PasswordResetCodeOrmEntity, {
      userId,
      sentAt: { $ne: null, $gte: since },
    });
  }

  async invalidateAllForUser(userId: string, now: Date): Promise<void> {
    await this.em.nativeUpdate(
      PasswordResetCodeOrmEntity,
      { userId, consumedAt: null },
      { consumedAt: now, updatedAt: now },
    );
  }

  /**
   * Conta a tentativa numa transação PRÓPRIA, que commita mesmo que a da requisição role para trás.
   *
   * `em.fork()` cria um EntityManager independente que herda os parâmetros de filtro — inclusive o
   * `accountId` do tenant —, de modo que o `TenantScopeSubscriber` escreve o `set_config` desta
   * transação também. Nada aqui contorna o RLS: a policy vale igual, e um id de outra conta não
   * atualizaria linha nenhuma.
   *
   * O incremento vai como expressão SQL, e não como leitura seguida de escrita, porque duas
   * tentativas simultâneas leriam o mesmo valor e gravariam o mesmo `attempts + 1` — dando ao
   * atacante duas chances pelo preço de uma.
   */
  async registerFailedAttempt(codeId: string): Promise<number> {
    const fork = this.em.fork();

    return fork.transactional(async (tx) => {
      await tx
        .getConnection()
        .execute(
          'update password_reset_codes set attempts = attempts + 1, updated_at = now() where id = ?',
          [codeId],
          'run',
          tx.getTransactionContext(),
        );

      const rows = await tx
        .getConnection()
        .execute<{ attempts: number }[]>(
          'select attempts from password_reset_codes where id = ?',
          [codeId],
          'all',
          tx.getTransactionContext(),
        );

      // Zero linhas significa que a policy recusou (id de outra conta) ou o código sumiu. Devolver
      // o teto trata o caso como esgotado — falhar fechado, nunca aberto.
      return rows.length > 0 ? Number(rows[0].attempts) : Number.MAX_SAFE_INTEGER;
    });
  }

  async save(code: PasswordResetCode): Promise<PasswordResetCode> {
    const orm = await this.em.upsert(PasswordResetCodeOrmEntity, {
      id: code.id,
      accountId: code.accountId,
      userId: code.userId,
      codeHash: code.codeHash,
      expiresAt: code.expiresAt,
      attempts: code.attempts,
      consumedAt: code.consumedAt,
      sentAt: code.sentAt,
      createdAt: code.createdAt,
      updatedAt: new Date(),
      deletedAt: null,
    });
    await this.em.flush();
    return this.toDomain(orm);
  }

  /** Inline rather than a mapper class: one shape, one consumer, no domain conversion beyond this. */
  private toDomain(orm: PasswordResetCodeOrmEntity): PasswordResetCode {
    return PasswordResetCode.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      userId: orm.userId,
      codeHash: orm.codeHash,
      expiresAt: orm.expiresAt,
      attempts: orm.attempts,
      consumedAt: orm.consumedAt,
      sentAt: orm.sentAt,
      createdAt: orm.createdAt,
    });
  }
}
