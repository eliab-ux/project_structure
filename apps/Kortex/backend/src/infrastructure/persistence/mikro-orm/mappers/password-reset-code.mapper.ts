import { Injectable } from '@nestjs/common';
import { PasswordResetCode } from '../../../../contexts/auth/domain/entities/password-reset-code.entity';
import { PasswordResetCodeId } from '../../../../contexts/auth/domain/value-objects/password-reset-code-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { PasswordResetCodeOrmEntity } from '../entities/password-reset-code-orm.entity';

@Injectable()
export class PasswordResetCodeMapper {
  toDomain(orm: PasswordResetCodeOrmEntity): PasswordResetCode {
    return PasswordResetCode.restore({
      id: PasswordResetCodeId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      userId: UserId.from(orm.userId),
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
    target: PasswordResetCodeOrmEntity = new PasswordResetCodeOrmEntity(),
  ): PasswordResetCodeOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.userId = domain.userId.value;
    target.codeHash = domain.codeHash;
    target.expiresAt = domain.expiresAt;
    target.usedAt = domain.usedAt;
    target.sentAt = domain.sentAt;
    target.attempts = domain.attempts;
    target.createdAt = domain.createdAt;
    return target;
  }
}
