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
import { DeactivateContactCommand } from './set-contact-routing.command';

/**
 * Takes a contact out of routing without deleting them — the answer to "this one must stop receiving,
 * but I cannot delete them".
 *
 * Why this exists: `DeleteContactUseCase` refuses anyone who already appears in a dispatch, because
 * that record is the proof of what was sent to whom and when. The refusal is right, but for a long
 * while it pointed the operator at a "Remover dos envios" action that had never been built — leaving
 * "must not receive again" with no way to express it. This is that action.
 *
 * It is `active = false` and nothing more, which is enough because every send path already honours it,
 * in two independent layers (§9.1 planning excludes non-routable contacts; execution re-checks and
 * blocks with `CONTACT_INACTIVE`). No new column: a second flag meaning "out of the base" would have to
 * be remembered by every audience query, and the first one to forget it messages someone who was
 * removed.
 *
 * **Deliberately NOT an opt-out.** `opt_out_rate` feeds the throttle (§2.1) — 2% cuts the chip's quota
 * in half. Filing an operator's decision as "the contact asked to leave" would punish a healthy chip
 * for a housekeeping action, and would also claim consent history that never happened.
 *
 * Idempotent: deactivating an already-inactive contact succeeds without writing an audit line, because
 * a trail full of no-ops makes the real events harder to find.
 */
@Injectable()
export class DeactivateContactUseCase implements UseCase<DeactivateContactCommand, ContactDto> {
  private readonly logger = new Logger(DeactivateContactUseCase.name);

  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DeactivateContactCommand): Promise<ContactDto> {
    // Tenant-scoped read: a contact of another account is simply not found.
    const contact = await this.contacts.findById(ContactId.from(command.contactId));
    if (!contact) {
      throw new ContactNotFoundException();
    }

    if (!contact.active) {
      return ContactDto.fromDomain(contact);
    }

    contact.deactivate();
    const saved = await this.contacts.save(contact);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTACT_DEACTIVATED,
      entityType: 'contact',
      entityId: saved.id.value,
      ip: command.ip,
      // Masked phone only — an audit payload never carries a full number (§16).
      payload: { phoneMasked: contact.phone.masked, name: contact.name },
    });

    this.logger.log('Contato removido dos envios', {
      contactId: saved.id.value,
      performedBy: command.performedBy,
    });
    return ContactDto.fromDomain(saved);
  }
}
