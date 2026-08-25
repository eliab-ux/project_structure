import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult, Pagination, UseCase } from '@gitspread/shared-kernel';
import { ContactDto } from '../../dto/contact.dto';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { ListContactsQuery } from './list-contacts.query';

@Injectable()
export class ListContactsUseCase implements UseCase<
  ListContactsQuery,
  PaginatedResult<ContactDto>
> {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort) {}

  async execute(query: ListContactsQuery): Promise<PaginatedResult<ContactDto>> {
    const params = Pagination.create(query.page, query.limit);
    // Tenant-scoped by the global filter: no accountId reaches the repository.
    const page = await this.contacts.list({
      ...params,
      tags: query.tags,
      channelId: query.channelId,
      active: query.active,
      optedOut: query.optedOut,
      search: query.search,
    });

    return { data: page.data.map((contact) => ContactDto.fromDomain(contact)), meta: page.meta };
  }
}
