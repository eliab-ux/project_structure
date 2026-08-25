import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult, Pagination, UseCase } from '@gitspread/shared-kernel';
import { ContentDto } from '../../dto/content.dto';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../ports/output/content-repository.port';
import { ListContentsQuery } from './list-contents.query';

@Injectable()
export class ListContentsUseCase implements UseCase<
  ListContentsQuery,
  PaginatedResult<ContentDto>
> {
  constructor(@Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort) {}

  async execute(query: ListContentsQuery): Promise<PaginatedResult<ContentDto>> {
    const params = Pagination.create(query.page, query.limit);
    // Tenant-scoped by the global filter: no accountId reaches the repository.
    const page = await this.contents.list({
      ...params,
      status: query.status,
      classification: query.classification,
      search: query.search,
    });

    return { data: page.data.map((content) => ContentDto.fromDomain(content)), meta: page.meta };
  }
}
