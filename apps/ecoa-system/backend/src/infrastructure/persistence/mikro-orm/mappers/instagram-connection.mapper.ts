import { Injectable } from '@nestjs/common';
import { InstagramConnection } from '../../../../contexts/connection/domain/entities/instagram-connection.entity';
import { ConnectionId } from '../../../../contexts/connection/domain/value-objects/connection-id.vo';
import { ConnectionStatus } from '../../../../contexts/connection/domain/value-objects/connection-status.vo';
import { InstagramConnectionOrmEntity } from '../entities/instagram-connection-orm.entity';

@Injectable()
export class InstagramConnectionMapper {
  toDomain(orm: InstagramConnectionOrmEntity): InstagramConnection {
    return InstagramConnection.reconstitute(
      ConnectionId.from(orm.id),
      orm.ownerId,
      orm.igUserId,
      orm.username,
      orm.accessTokenEncrypted,
      orm.tokenExpiresAt ?? null,
      ConnectionStatus.from(orm.status),
      orm.connectedAt,
    );
  }

  toOrm(
    domain: InstagramConnection,
    existing?: InstagramConnectionOrmEntity,
  ): InstagramConnectionOrmEntity {
    const orm = existing ?? new InstagramConnectionOrmEntity();
    orm.id = domain.id.value;
    orm.ownerId = domain.ownerId;
    orm.igUserId = domain.igUserId;
    orm.username = domain.username;
    orm.accessTokenEncrypted = domain.accessTokenEncrypted;
    orm.tokenExpiresAt = domain.tokenExpiresAt;
    orm.status = domain.status.value;
    orm.connectedAt = domain.connectedAt;
    return orm;
  }
}
