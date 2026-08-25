import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';
import { MediaDto } from '../../dto/media.dto';
import { ListOwnMediaQuery } from './list-own-media.query';

export interface ListOwnMediaResult {
  items: MediaDto[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ListOwnMediaUseCase implements UseCase<ListOwnMediaQuery, ListOwnMediaResult> {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly contentRepository: ContentRepositoryPort,
  ) {}

  async execute(query: ListOwnMediaQuery): Promise<ListOwnMediaResult> {
    const { items, total } = await this.contentRepository.listByOwner(
      query.ownerId,
      query.page,
      query.limit,
    );

    return {
      items: items.map((media) => MediaDto.fromDomain(media)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
