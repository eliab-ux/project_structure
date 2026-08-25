import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult, Pagination, UseCase } from '@gitspread/shared-kernel';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../../../content/application/ports/output/content-repository.port';
import { ContentId } from '../../../../content/domain/value-objects/content-id.vo';
import { DistributionDto } from '../../dto/distribution.dto';
import {
  DISTRIBUTION_REPOSITORY,
  DistributionRepositoryPort,
} from '../../ports/output/distribution-repositories.port';
import { ListDistributionsQuery } from './list-distributions.query';

@Injectable()
export class ListDistributionsUseCase implements UseCase<
  ListDistributionsQuery,
  PaginatedResult<DistributionDto>
> {
  constructor(
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
  ) {}

  async execute(query: ListDistributionsQuery): Promise<PaginatedResult<DistributionDto>> {
    const page = await this.distributions.list({
      // Defaults applied here, once, as everywhere else in the codebase — the repository receives a
      // settled page/limit rather than deciding for itself.
      ...Pagination.create(query.page, query.limit),
      status: query.status,
      contentId: query.contentId,
    });

    // Titles resolved in one pass over the distinct content ids: the list screen shows the campaign by
    // its content title, and N+1 lookups on a paginated list is the classic way that gets slow.
    const uniqueContentIds = [...new Set(page.data.map((distribution) => distribution.contentId))];
    const titles = new Map<string, string>();
    await Promise.all(
      uniqueContentIds.map(async (contentId) => {
        const content = await this.contents.findById(ContentId.from(contentId));
        titles.set(contentId, content?.title ?? 'Conteúdo removido');
      }),
    );

    return {
      data: page.data.map((distribution) =>
        DistributionDto.fromDomain(distribution, titles.get(distribution.contentId) ?? ''),
      ),
      meta: page.meta,
    };
  }
}
