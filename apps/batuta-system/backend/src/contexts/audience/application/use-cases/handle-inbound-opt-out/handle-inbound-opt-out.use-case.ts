import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../../../channel/application/ports/output/channel-repository.port';
import { ChannelId } from '../../../../channel/domain/value-objects/channel-id.vo';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import {
  WHATSAPP_GATEWAY,
  WhatsAppGatewayPort,
} from '../../../../../infrastructure/whatsapp/ports/whatsapp-gateway.port';
import {
  OPT_OUT_CONFIRMATION_MESSAGE,
  isOptOutRequest,
} from '../../../domain/services/opt-out-keywords';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { HandleInboundOptOutCommand } from './handle-inbound-opt-out.command';

export class InboundOptOutResultDto {
  detected!: boolean;
  optedOut!: boolean;
  confirmationSent!: boolean;
}

/**
 * Automatic opt-out from an inbound message (§6.5).
 *
 * This is the ONLY automatic reply the whole system is allowed to send (§1.10) — everything else is
 * drafted by a human. The confirmation goes out through the SAME chip that the contact knows, because
 * a reply from a different number reads as another unsolicited message.
 *
 * Failure to send the confirmation does NOT undo the opt-out: the contact asked to be removed, and
 * being removed is more important than being told. The failure is logged.
 */
@Injectable()
export class HandleInboundOptOutUseCase implements UseCase<
  HandleInboundOptOutCommand,
  InboundOptOutResultDto
> {
  private readonly logger = new Logger(HandleInboundOptOutUseCase.name);

  constructor(
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: HandleInboundOptOutCommand): Promise<InboundOptOutResultDto> {
    const result = new InboundOptOutResultDto();
    result.detected = isOptOutRequest(command.body);
    result.optedOut = false;
    result.confirmationSent = false;

    if (!result.detected) {
      // Anything else is conversation and belongs in the human queue (FASE 8).
      return result;
    }

    let phone: PhoneE164;
    try {
      phone = PhoneE164.create(command.fromPhone);
    } catch {
      this.logger.warn('Opt-out recebido de telefone que não normaliza — ignorado');
      return result;
    }

    const contact = await this.contacts.findByPhone(phone);
    if (!contact) {
      // Someone who is not in our base asking to stop: nothing to remove, and nothing to reply to.
      this.logger.log('Opt-out de número desconhecido — ignorado');
      return result;
    }

    if (contact.hasOptedOut) {
      // Already out. Not an error, and no second confirmation: that would be a second message to
      // someone who asked for none.
      this.logger.debug('Opt-out repetido — já estava fora do roteamento');
      result.optedOut = true;
      return result;
    }

    contact.optOut('KEYWORD', null);
    const saved = await this.contacts.save(contact);
    await this.events.publishAll(contact.pullDomainEvents());
    result.optedOut = true;

    await this.audit.execute({
      accountId: command.accountId,
      // No human actor: the contact asked, the system complied.
      actorType: AuditActorType.SYSTEM,
      actorId: null,
      action: AuditAction.CONTACT_OPTED_OUT,
      entityType: 'contact',
      entityId: saved.id.value,
      // Never the message body — the audit payload sanitizer would redact it anyway.
      payload: { reason: 'KEYWORD', phone: contact.phone.masked },
    });

    result.confirmationSent = await this.sendConfirmation(command, contact.phone);

    this.logger.log('Opt-out automático aplicado', {
      contactId: saved.id,
      confirmationSent: result.confirmationSent,
    });
    return result;
  }

  private async sendConfirmation(
    command: HandleInboundOptOutCommand,
    phone: PhoneE164,
  ): Promise<boolean> {
    try {
      const channel = await this.channels.findById(ChannelId.from(command.channelId));
      if (!channel || !channel.canSend) {
        this.logger.warn('Confirmação de opt-out não enviada: canal indisponível', {
          channelId: command.channelId,
        });
        return false;
      }

      await this.gateway.sendText({
        instance: {
          instanceName: channel.evolutionInstanceName,
          accountId: command.accountId,
        },
        toDigits: phone.digits,
        text: OPT_OUT_CONFIRMATION_MESSAGE,
      });
      return true;
    } catch (error) {
      // The opt-out already happened and stays. Only the courtesy failed.
      this.logger.warn('Falha ao enviar confirmação de opt-out', {
        error: (error as Error)?.message,
      });
      return false;
    }
  }
}
