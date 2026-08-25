import { Injectable } from '@nestjs/common';
import { Account } from '../../../../contexts/account/domain/entities/account.entity';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { Document } from '../../../../contexts/account/domain/value-objects/document.vo';
import { AccountOrmEntity } from '../entities/account-orm.entity';

@Injectable()
export class AccountMapper {
  toDomain(orm: AccountOrmEntity): Account {
    return Account.reconstitute({
      id: AccountId.from(orm.id),
      name: orm.name,
      document: Document.create(orm.document),
      plan: orm.plan,
      status: orm.status,
      dailySendCeiling: orm.dailySendCeiling,
      timezone: orm.timezone,
      evolutionServerUrl: orm.evolutionServerUrl,
      evolutionApiKey: orm.evolutionApiKey,
      suspendedAt: orm.suspendedAt,
      suspensionReason: orm.suspensionReason,
      createdAt: orm.createdAt,
    });
  }

  /** Plain object for `em.upsert` — see the note on writes in the repositories. */
  toOrmData(account: Account): Record<string, unknown> {
    return {
      id: account.id.value,
      name: account.name,
      document: account.document.value,
      plan: account.plan,
      status: account.status,
      dailySendCeiling: account.dailySendCeiling,
      timezone: account.timezone,
      evolutionServerUrl: account.evolutionServerUrl,
      evolutionApiKey: account.evolutionApiKey,
      suspendedAt: account.suspendedAt,
      suspensionReason: account.suspensionReason,
      createdAt: account.createdAt,
    };
  }
}
