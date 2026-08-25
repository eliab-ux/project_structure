import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ContactTagDto } from '../../dto/contact.dto';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { ListContactTagsQuery } from './list-contact-tags.query';

/**
 * The tags that exist in the base, for choosing an audience instead of typing one from memory.
 *
 * A typed tag that does not exist produces an empty campaign and no error — the operator sees
 * "nenhum contato enviável" and has no way to tell a typo from an empty segment. Picking from a list
 * removes that failure rather than reporting it better.
 */
@Injectable()
export class ListContactTagsUseCase implements UseCase<ListContactTagsQuery, ContactTagDto[]> {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort) {}

  async execute(_query: ListContactTagsQuery): Promise<ContactTagDto[]> {
    const tags = await this.contacts.listTags();
    return tags.map((tag) => {
      const dto = new ContactTagDto();
      dto.tag = tag.tag;
      dto.contacts = tag.contacts;
      return dto;
    });
  }
}
