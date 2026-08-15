import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@veertex/shared-kernel';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { ContactId } from '../../../domain/value-objects/contact-id.vo';
import { ContactDto } from '../../dto/contact.dto';
import { ContactNotFoundException } from '../../../domain/exceptions/contact-exceptions';

export class GetContactQuery {
  constructor(public readonly id: string) {}
}

/** Um contato pelo id. Contato de outra conta some no escopo e responde "não encontrado". */
@Injectable()
export class GetContactUseCase implements UseCase<GetContactQuery, ContactDto> {
  constructor(@Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort) {}

  async execute(query: GetContactQuery): Promise<ContactDto> {
    const contact = await this.contacts.findById(ContactId.from(query.id));
    if (!contact) {
      throw new ContactNotFoundException(query.id);
    }
    return ContactDto.fromDomain(contact);
  }
}
