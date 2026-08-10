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
