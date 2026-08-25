import { OwnMedia } from '../../domain/entities/own-media.entity';

/** Application-boundary view of a tenant's own media. */
export class MediaDto {
  id!: string;
  igMediaId!: string;
  permalink!: string;
  mediaType!: string;
  caption!: string | null;
  thumbnailUrl!: string | null;
  publishedAt!: Date;

  static fromDomain(media: OwnMedia): MediaDto {
    const dto = new MediaDto();
    dto.id = media.id.value;
    dto.igMediaId = media.igMediaId;
    dto.permalink = media.permalink;
    dto.mediaType = media.mediaType;
    dto.caption = media.caption;
    dto.thumbnailUrl = media.thumbnailUrl;
    dto.publishedAt = media.publishedAt;
    return dto;
  }
}
