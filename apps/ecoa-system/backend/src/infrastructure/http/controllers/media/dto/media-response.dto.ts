import { MediaDto } from '../../../../../contexts/content/application/dto/media.dto';

export class MediaResponseDto {
  id!: string;
  igMediaId!: string;
  permalink!: string;
  mediaType!: string;
  caption!: string | null;
  thumbnailUrl!: string | null;
  publishedAt!: Date;

  static fromDto(media: MediaDto): MediaResponseDto {
    const dto = new MediaResponseDto();
    dto.id = media.id;
    dto.igMediaId = media.igMediaId;
    dto.permalink = media.permalink;
    dto.mediaType = media.mediaType;
    dto.caption = media.caption;
    dto.thumbnailUrl = media.thumbnailUrl;
    dto.publishedAt = media.publishedAt;
    return dto;
  }
}
