import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PasswordResetCode } from '../../../../contexts/auth/domain/entities/password-reset-code.entity';
import { PasswordResetCodeRepositoryPort } from '../../../../contexts/auth/application/ports/output/password-reset-code-repository.port';
import { PasswordResetCodeOrmEntity } from '../entities/password-reset-code-orm.entity';
import { TENANT_FILTER } from '../entities/tenant-scoped-orm.entity';

/**
 * The recovery flow is anonymous by nature — nobody holds a JWT while asking to reset a password —
 * so these queries run with the tenant filter disabled. What protects them is the code itself: six
 * digits stored only as a bcrypt hash, single use, 15 minutes, five attempts.
 *
 * The `userId` is always resolved beforehand from the e-mail, and the `accountId` is READ from the
 * row. Neither is ever taken from the request.
 */
const UNSCOPED = { filters: { [TENANT_FILTER]: false } };

@Injectable()
export class MikroOrmPasswordResetCodeRepository implements PasswordResetCodeRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async save(code: PasswordResetCode): Promise<PasswordResetCode> {
    const data = {
      accountId: code.accountId,
      userId: code.userId,
      codeHash: code.codeHash,
      expiresAt: code.expiresAt,
      usedAt: code.usedAt,
      sentAt: code.sentAt,
      attempts: code.attempts,
      createdAt: code.createdAt,
    };

    // Upsert by primary key: the same aggregate is saved twice in one request (once on issue, once
    // after the message goes out), and the second save must not insert a duplicate row.
    const affected = await this.em.nativeUpdate(
      PasswordResetCodeOrmEntity,
      { id: code.id },
      data,
      UNSCOPED,
    );
    if (affected === 0) {
      await this.em.insert(PasswordResetCodeOrmEntity, { id: code.id, ...data });
    }

    return code;
  }

  async findLatestUnused(userId: string): Promise<PasswordResetCode | null> {
    const orm = await this.em.findOne(
      PasswordResetCodeOrmEntity,
      { userId, usedAt: null },
      { ...UNSCOPED, orderBy: { createdAt: 'desc' } },
    );
    return orm ? this.toDomain(orm) : null;
  }

  async countSentSince(userId: string, since: Date): Promise<number> {
    return this.em.count(PasswordResetCodeOrmEntity, { userId, sentAt: { $gte: since } }, UNSCOPED);
  }

  async invalidateAllForUser(userId: string, now: Date): Promise<void> {
    await this.em.nativeUpdate(
      PasswordResetCodeOrmEntity,
      { userId, usedAt: null },
      { usedAt: now },
      UNSCOPED,
    );
  }

  private toDomain(orm: PasswordResetCodeOrmEntity): PasswordResetCode {
    return PasswordResetCode.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      userId: orm.userId,
      codeHash: orm.codeHash,
      expiresAt: orm.expiresAt,
      usedAt: orm.usedAt,
      sentAt: orm.sentAt,
      attempts: orm.attempts,
      createdAt: orm.createdAt,
    });
  }
}
