import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ContactId } from '../../../domain/value-objects/contact-id.vo';
import { ContactNotFoundException } from '../../../domain/exceptions/contact-not-found.exception';
import { ContactDetailDto, ContactDto } from '../../dto/contact.dto';
import {
  CONTACT_SENDER_HISTORY_REPOSITORY,
  ContactSenderHistoryRepositoryPort,
} from '../../ports/output/contact-import.ports';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { GetContactQuery } from './get-contact.query';

/**
 * One contact, with its full sender history.
 *
 * The history is the reason `contact_sender_history` exists (§4): it answers "qual número falou com
 * esta pessoa em março?" — the question support and an audit both ask, and the one thing you cannot
 * reconstruct after the fact if you only kept the current sender.
 */
@Injectable()
export class GetContactUseCase implements UseCase<GetContactQuery, ContactDetailDto> {
  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(CONTACT_SENDER_HISTORY_REPOSITORY)
    private readonly history: ContactSenderHistoryRepositoryPort,
  ) {}

  async execute(query: GetContactQuery): Promise<ContactDetailDto> {
    const contact = await this.contacts.findById(ContactId.from(query.contactId));
    if (!contact) {
      throw new ContactNotFoundException();
    }

    const entries = await this.history.listForContact(contact.id.value);

    const dto = new ContactDetailDto();
    dto.contact = ContactDto.fromDomain(contact);
    dto.senderHistory = entries.map((entry) => ({
      channelId: entry.channelId,
      assignedAt: entry.assignedAt,
      releasedAt: entry.releasedAt,
      reason: entry.reason,
      migrationId: entry.migrationId,
    }));
    return dto;
  }
}
