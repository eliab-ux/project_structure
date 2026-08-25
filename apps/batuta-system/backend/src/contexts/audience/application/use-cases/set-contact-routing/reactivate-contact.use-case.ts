import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { ContactId } from '../../../domain/value-objects/contact-id.vo';
import { ContactNotFoundException } from '../../../domain/exceptions/contact-not-found.exception';
import { ContactDto } from '../../dto/contact.dto';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { ReactivateContactCommand } from './set-contact-routing.command';

/**
 * Puts a contact back into routing.
 *
 * The counterpart of `DeactivateContactUseCase`, and the reason it exists is a lesson this project has
 * already paid for once: a state with no way out turns a small mistake into a permanent one. Most
 * deactivations are "wrong number" or "pause this one", and both get revisited — deactivating by
 * accident with no undo would mean losing a contact to a misclick.
 *
 * **The asymmetry with opt-out is the point.** An opt-out has no counterpart use case and no endpoint
 * that clears it, because it records the CONTACT's decision. This records an operator's. The guard that
 * separates them lives in `Contact.reactivate()` — in the entity, so no future caller can reach
 * `active = true` on someone who asked to be left alone, whatever path it arrives by. Here it surfaces
 * as a 400 with the reason, never as a silent no-op.
 *
 * Idempotent for an already-active contact, and for the same reason as its counterpart: no audit noise.
 */
@Injectable()
export class ReactivateContactUseCase implements UseCase<ReactivateContactCommand, ContactDto> {
  private readonly logger = new Logger(ReactivateContactUseCase.name);

  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ReactivateContactCommand): Promise<ContactDto> {
    const contact = await this.contacts.findById(ContactId.from(command.contactId));
    if (!contact) {
      throw new ContactNotFoundException();
    }

    if (contact.active) {
      return ContactDto.fromDomain(contact);
    }

    // Throws ContactNotReactivatableException for an opted-out contact — checked in the entity.
    contact.reactivate();
    const saved = await this.contacts.save(contact);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTACT_REACTIVATED,
      entityType: 'contact',
      entityId: saved.id.value,
      ip: command.ip,
      payload: { phoneMasked: contact.phone.masked, name: contact.name },
    });

    this.logger.log('Contato devolvido aos envios', {
      contactId: saved.id.value,
      performedBy: command.performedBy,
    });
    return ContactDto.fromDomain(saved);
  }
}
