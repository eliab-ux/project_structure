import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  INSTAGRAM_GATEWAY,
  InstagramGatewayPort,
} from '../../../../../infrastructure/integrations/instagram/ports/instagram-gateway.port';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';
import { OwnMedia } from '../../../domain/entities/own-media.entity';
import { SyncOwnMediaCommand } from './sync-own-media.command';

export interface SyncOwnMediaResult {
  synced: number;
}

@Injectable()
export class SyncOwnMediaUseCase implements UseCase<SyncOwnMediaCommand, SyncOwnMediaResult> {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contentRepository: ContentRepositoryPort,
    @Inject(INSTAGRAM_GATEWAY) private readonly gateway: InstagramGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: SyncOwnMediaCommand): Promise<SyncOwnMediaResult> {
    const remote = await this.gateway.fetchRecentMedia(
      command.igUserId,
      command.accessToken,
      command.limit,
    );

    return this.uow.execute(async () => {
      let synced = 0;
      for (const item of remote) {
        // Owner-scoped upsert: refresh the existing record or create a new one.
        const existing = await this.contentRepository.findByOwnerAndIgMediaId(
          command.ownerId,
          item.igMediaId,
        );

        if (existing) {
          existing.updateFromSync(item.permalink, item.mediaType, item.caption, item.thumbnailUrl);
          await this.contentRepository.save(existing);
        } else {
          const media = OwnMedia.create(
            command.ownerId,
            item.igMediaId,
            item.permalink,
            item.mediaType,
            item.caption,
            item.thumbnailUrl,
            item.publishedAt,
          );
          await this.contentRepository.save(media);
        }
        synced += 1;
      }
      return { synced };
    });
  }
}
