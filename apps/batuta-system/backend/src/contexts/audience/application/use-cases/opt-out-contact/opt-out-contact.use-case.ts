import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import { ContactId } from '../../../domain/value-objects/contact-id.vo';
import { ContactNotFoundException } from '../../../domain/exceptions/contact-not-found.exception';
import { ContactDto } from '../../dto/contact.dto';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { OptOutContactCommand } from './opt-out-contact.command';

/**
 * Manual opt-out by an operator (§6.5): permanent removal from routing, irreversible by the UI.
 *
 * There is no counterpart use case. `optIn()` does not exist on the entity, no endpoint clears
 * `opted_out_at`, and that is deliberate: someone who asked to be left alone stays left alone, and
 * bringing them back has to be a new, deliberate, provenance-bearing import.
 */
@Injectable()
export class OptOutContactUseCase implements UseCase<OptOutContactCommand, ContactDto> {
  private readonly logger = new Logger(OptOutContactUseCase.name);

  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: OptOutContactCommand): Promise<ContactDto> {
    const contact = await this.contacts.findById(ContactId.from(command.contactId));
    if (!contact) {
      throw new ContactNotFoundException();
    }

    contact.optOut('MANUAL', command.performedBy);
    const saved = await this.contacts.save(contact);
    await this.events.publishAll(contact.pullDomainEvents());

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTACT_OPTED_OUT,
      entityType: 'contact',
      entityId: saved.id.value,
      ip: command.ip,
      // Masked phone only — an audit payload never carries a full number.
      payload: { reason: 'MANUAL', phone: contact.phone.masked },
    });

    this.logger.log('Contato marcado como opt-out', { contactId: saved.id });
    return ContactDto.fromDomain(saved);
  }
}
