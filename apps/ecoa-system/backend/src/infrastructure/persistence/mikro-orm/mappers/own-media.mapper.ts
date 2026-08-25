import { Injectable } from '@nestjs/common';
import { OwnMedia } from '../../../../contexts/content/domain/entities/own-media.entity';
import { OwnMediaId } from '../../../../contexts/content/domain/value-objects/own-media-id.vo';
import { OwnMediaOrmEntity } from '../entities/own-media-orm.entity';

@Injectable()
export class OwnMediaMapper {
  toDomain(orm: OwnMediaOrmEntity): OwnMedia {
    return OwnMedia.reconstitute(
      OwnMediaId.from(orm.id),
      orm.ownerId,
      orm.igMediaId,
      orm.permalink,
      orm.mediaType,
      orm.caption ?? null,
      orm.thumbnailUrl ?? null,
      orm.publishedAt,
    );
  }

  toOrm(domain: OwnMedia, existing?: OwnMediaOrmEntity): OwnMediaOrmEntity {
    const orm = existing ?? new OwnMediaOrmEntity();
    orm.id = domain.id.value;
    orm.ownerId = domain.ownerId;
    orm.igMediaId = domain.igMediaId;
    orm.permalink = domain.permalink;
    orm.mediaType = domain.mediaType;
    orm.caption = domain.caption;
    orm.thumbnailUrl = domain.thumbnailUrl;
    orm.publishedAt = domain.publishedAt;
    return orm;
  }
}
