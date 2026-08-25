import { Injectable } from '@nestjs/common';
import { PasswordResetCode } from '../../../../contexts/auth/domain/entities/password-reset-code.entity';
import { PasswordResetCodeOrmEntity } from '../entities/password-reset-code-orm.entity';

@Injectable()
export class PasswordResetCodeMapper {
  toDomain(orm: PasswordResetCodeOrmEntity): PasswordResetCode {
    return PasswordResetCode.reconstitute({
      id: orm.id,
      userId: orm.userId,
      codeHash: orm.codeHash,
      expiresAt: orm.expiresAt,
      usedAt: orm.usedAt,
      sentAt: orm.sentAt,
      attempts: orm.attempts,
      createdAt: orm.createdAt,
    });
  }

  toOrm(
    domain: PasswordResetCode,
    existing?: PasswordResetCodeOrmEntity,
  ): PasswordResetCodeOrmEntity {
    const orm = existing ?? new PasswordResetCodeOrmEntity();
    orm.id = domain.id;
    orm.userId = domain.userId;
    orm.codeHash = domain.codeHash;
    orm.expiresAt = domain.expiresAt;
    orm.usedAt = domain.usedAt;
    orm.sentAt = domain.sentAt;
    orm.attempts = domain.attempts;
    orm.createdAt = domain.createdAt;
    return orm;
  }
}
