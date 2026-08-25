import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { ContactId } from '../../../domain/value-objects/contact-id.vo';
import { ContactNotFoundException } from '../../../domain/exceptions/contact-not-found.exception';
import { ContactNotDeletableException } from '../../../domain/exceptions/contact-not-deletable.exception';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { CONTACT_USAGE, ContactUsagePort } from '../../ports/output/contact-usage.port';
import { DeleteContactCommand } from './delete-contact.command';

/**
 * Removes a contact from the base for good.
 *
 * The feature exists for the ordinary cases: a wrong number, a duplicate that slipped past the
 * dedup, someone who should never have been imported. For those, deactivating leaves a row the
 * operator has to keep scrolling past, so deletion is the honest answer.
 *
 * It refuses in exactly two situations, and both refusals are the point of the use case rather than
 * limitations of it — see `ContactNotDeletableException` for why each one outranks the cleanup.
 *
 * Everything that belongs only to this person goes with them: the conversation, its messages and the
 * sender history all cascade at the database level. The audit line stays, with the phone MASKED —
 * enough to answer "who was removed and by whom", never enough to reconstruct the list.
 */
@Injectable()
export class DeleteContactUseCase implements UseCase<DeleteContactCommand, void> {
  private readonly logger = new Logger(DeleteContactUseCase.name);

  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(CONTACT_USAGE) private readonly usage: ContactUsagePort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DeleteContactCommand): Promise<void> {
    // Tenant-scoped read: a contact of another account is simply not found.
    const contact = await this.contacts.findById(ContactId.from(command.contactId));
    if (!contact) {
      throw new ContactNotFoundException();
    }

    if (contact.hasOptedOut) {
      throw new ContactNotDeletableException(
        'Este contato pediu para sair, e a saída é definitiva. Excluir a linha faria a próxima ' +
          'importação da mesma planilha trazer o número de volta sem a marca de opt-out — ou seja, ' +
          'ele voltaria a receber mensagens. Ele já está permanentemente fora dos envios.',
      );
    }

    const dispatches = await this.usage.countDispatches(command.contactId);
    if (dispatches > 0) {
      throw new ContactNotDeletableException(
        `Este contato já faz parte de ${dispatches} envio(s) registrado(s), e esse registro é a ` +
          'prova do que foi enviado, para quem e quando. Use "Remover dos envios" no botão de pausa ' +
          'da linha: ele passa a inativo, não entra em nenhuma distribuição nova, e o histórico ' +
          'continua intacto. Dá para desfazer depois, se for o caso.',
      );
    }

    // Recorded BEFORE the row disappears: after the delete there is nothing left to read the name and
    // tags from, and an audit line saying only "um contato foi excluído" answers nothing.
    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTACT_DELETED,
      entityType: 'contact',
      entityId: contact.id.value,
      ip: command.ip,
      // Masked: the trail says WHICH contact without printing the number (§16).
      payload: {
        phoneMasked: contact.phone.masked,
        name: contact.name,
        tags: [...contact.tags],
        channelId: contact.currentChannelId,
      },
    });

    await this.contacts.delete(contact.id);

    this.logger.log('Contato excluído', {
      contactId: contact.id.value,
      performedBy: command.performedBy,
    });
  }
}
