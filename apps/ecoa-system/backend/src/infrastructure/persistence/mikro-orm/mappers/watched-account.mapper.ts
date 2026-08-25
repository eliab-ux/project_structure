import { Injectable } from '@nestjs/common';
import { WatchedAccount } from '../../../../contexts/watchlist/domain/entities/watched-account.entity';
import { WatchedAccountId } from '../../../../contexts/watchlist/domain/value-objects/watched-account-id.vo';
import { Handle } from '../../../../contexts/watchlist/domain/value-objects/handle.vo';
import { WatchedAccountOrmEntity } from '../entities/watched-account-orm.entity';

@Injectable()
export class WatchedAccountMapper {
  toDomain(orm: WatchedAccountOrmEntity): WatchedAccount {
    return WatchedAccount.reconstitute(
      WatchedAccountId.from(orm.id),
      orm.ownerId,
      Handle.create(orm.handle),
      orm.igUserId ?? null,
      orm.active,
      orm.addedAt,
    );
  }

  toOrm(domain: WatchedAccount, existing?: WatchedAccountOrmEntity): WatchedAccountOrmEntity {
    const orm = existing ?? new WatchedAccountOrmEntity();
    orm.id = domain.id.value;
    orm.ownerId = domain.ownerId;
    orm.handle = domain.handle.value;
    orm.igUserId = domain.igUserId;
    orm.active = domain.active;
    orm.addedAt = domain.addedAt;
    return orm;
  }
}
