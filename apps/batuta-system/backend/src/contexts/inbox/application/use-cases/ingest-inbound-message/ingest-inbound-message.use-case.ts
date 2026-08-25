import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../../../audience/application/ports/output/contact-repository.port';
import { Contact } from '../../../../audience/domain/entities/contact.entity';
import { HandleInboundOptOutUseCase } from '../../../../audience/application/use-cases/handle-inbound-opt-out/handle-inbound-opt-out.use-case';
import { HandleInboundOptOutCommand } from '../../../../audience/application/use-cases/handle-inbound-opt-out/handle-inbound-opt-out.command';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import { Conversation } from '../../../domain/entities/conversation.entity';
import { Message } from '../../../domain/entities/message.entity';
import { ConversationPriority } from '../../../domain/value-objects/conversation-status.vo';
import { IntentClass } from '../../../domain/value-objects/intent-class.vo';
import { isMedia } from '../../../domain/value-objects/message-kind.vo';
import { classifyInbound } from '../../../domain/services/intent-classifier';
import { ConversationOpenedEvent } from '../../../domain/events/conversation-opened.event';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepositoryPort,
  INBOUND_MEDIA_DOWNLOADER,
  InboundMediaDownloaderPort,
  MESSAGE_REPOSITORY,
  MessageRepositoryPort,
} from '../../ports/output/inbox-repositories.port';
import { IngestInboundMessageCommand } from './ingest-inbound-message.command';

export class IngestResultDto {
  /** Null when the message was ignored (unknown contact, or already ingested). */
  conversationId!: string | null;
  messageId!: string | null;
  intentClass!: IntentClass | null;
  /** True when the system closed it without a human (opt-out or acknowledgement). */
  autoResolved!: boolean;
  /** True when it landed in the human queue. */
  queued!: boolean;
  ignoredReason!: string | null;
}

/**
 * Turns one inbound WhatsApp message into a queue item (§10.2).
 *
 * The order of operations is where the requirements live:
 *
 *  1. **Idempotency by provider message id.** Evolution retries webhooks; without this check a retry
 *     would add a second message to the thread and bump `unread_count` again.
 *  2. **Resolve the contact by phone.** An unknown number is IGNORED, not created: §6.1 requires
 *     provenance and a consent basis for every contact, and a stranger writing to a chip has neither.
 *     Silently importing them would be exactly the "importação sem base de consentimento" §2 forbids.
 *  3. **One conversation per contact** (§10.1), created or REOPENED. This is the rule the spec says
 *     makes or breaks the queue.
 *  4. **Media downloaded in the act** (§10.2 item 2), before the message row exists, because an
 *     Evolution URL will not survive until an operator opens the item.
 *  5. **Classify** (§10.2 item 4), then let the two auto-resolvable classes close themselves:
 *     opt-out runs the §6.5 automation, acknowledgement is archived WITHOUT a reply.
 *
 * What this use case never does: reply. Even the opt-out confirmation is sent by the §6.5 automation,
 * which is the one exception §2 allows — everything else waits for a human.
 */
@Injectable()
export class IngestInboundMessageUseCase implements UseCase<
  IngestInboundMessageCommand,
  IngestResultDto
> {
  private readonly logger = new Logger(IngestInboundMessageUseCase.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepositoryPort,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(INBOUND_MEDIA_DOWNLOADER) private readonly media: InboundMediaDownloaderPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly handleOptOut: HandleInboundOptOutUseCase,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: IngestInboundMessageCommand): Promise<IngestResultDto> {
    if (command.providerMessageId) {
      const known = await this.messages.existsByProviderMessageId(command.providerMessageId);
      if (known) {
        // A webhook retry. Not an error, and not something to record twice.
        return this.ignored('Mensagem já ingerida (reentrega do webhook).');
      }
    }

    const phone = PhoneE164.create(command.fromPhone);
    const contact = await this.resolveContact(phone);
    if (!contact) {
      // Deliberate: creating a contact here would be an import with no provenance and no consent
      // basis, which §6.1/§2 forbid. The message is dropped and the fact is logged with a masked number.
      this.logger.warn(
        `Inbound de número desconhecido — ignorado. phone=${phone.masked} ` +
          `canal=${command.channelId}`,
      );
      return this.ignored('Número não pertence à base desta conta.');
    }

    const classification = classifyInbound({ body: command.body, kind: command.kind });

    let conversation = await this.conversations.findByContactId(contact.id.value);
    const isNew = !conversation;
    if (!conversation) {
      conversation = Conversation.open({
        accountId: command.accountId,
        contactId: contact.id.value,
        channelId: command.channelId,
        intentClass: classification.intent,
        priority: classification.highPriority
          ? ConversationPriority.HIGH
          : ConversationPriority.NORMAL,
        occurredAt: command.occurredAt,
      });
    } else {
      conversation.registerInbound({
        channelId: command.channelId,
        intentClass: classification.intent,
        highPriority: classification.highPriority,
        occurredAt: command.occurredAt,
      });
    }

    // Saved before the media download so the conversation id exists for the storage key, and so a slow
    // download cannot lose the fact that this person wrote.
    const savedConversation = await this.conversations.save(conversation);

    let storageKey: string | null = null;
    let mediaFailure: string | null = null;
    if (isMedia(command.kind)) {
      const downloaded = await this.media.download({
        accountId: command.accountId,
        conversationId: savedConversation.id,
        base64: command.mediaBase64,
        url: command.mediaUrl,
        mimeType: command.mediaMimeType,
        fileName: command.mediaFileName,
        kind: command.kind,
      });
      storageKey = downloaded.storageKey;
      mediaFailure = downloaded.failureReason;
      if (mediaFailure) {
        // The message is kept anyway: an audio nobody can play still proves this person replied, and
        // dropping it would also corrupt the inbound_rate the throttle reads.
        this.logger.error('Falha ao baixar mídia recebida — mensagem preservada sem o arquivo', {
          conversationId: savedConversation.id,
          kind: command.kind,
          reason: mediaFailure,
        });
      }
    }

    const message = await this.messages.save(
      Message.inbound({
        accountId: command.accountId,
        conversationId: savedConversation.id,
        contactId: contact.id.value,
        channelId: command.channelId,
        kind: command.kind,
        body: command.body,
        mediaStorageKey: storageKey,
        providerMessageId: command.providerMessageId,
        occurredAt: command.occurredAt,
      }),
    );

    if (isNew) {
      await this.events.publish(
        new ConversationOpenedEvent(
          command.accountId,
          savedConversation.id,
          contact.id.value,
          command.channelId,
          classification.intent,
        ),
      );
    }

    // ---- the two classes that close themselves (§10.2 item 4) ---------------------------------
    if (classification.intent === IntentClass.OPT_OUT) {
      // The §6.5 automation owns this: it opts the contact out, sends the one permitted automatic
      // reply, and audits it. Duplicating any of that here would be a second source of truth.
      await this.handleOptOut.execute(
        new HandleInboundOptOutCommand(
          command.accountId,
          command.fromPhone,
          command.body ?? '',
          command.channelId,
        ),
      );
      savedConversation.archive(null);
      await this.conversations.save(savedConversation);

      return this.resolved(savedConversation.id, message.id, classification.intent, true, false);
    }

    if (classification.intent === IntentClass.ACKNOWLEDGMENT) {
      // Archived WITHOUT replying. Answering "obrigado" with "de nada" doubles a chip's traffic for
      // nothing, and traffic is what gets numbers banned (§15 risco 2).
      savedConversation.archive(null);
      await this.conversations.save(savedConversation);

      return this.resolved(savedConversation.id, message.id, classification.intent, true, false);
    }

    if (classification.intent === IntentClass.WRONG_NUMBER) {
      // Out of routing immediately — §10.2 says "tira do roteamento" — but the item still goes to a
      // human, because "quem é você?" sometimes comes from the right person.
      contact.flagForReview();
      await this.contacts.save(contact);
      await this.audit.execute({
        accountId: command.accountId,
        actorType: AuditActorType.SYSTEM,
        actorId: null,
        action: AuditAction.CONTACT_FLAGGED_FOR_REVIEW,
        entityType: 'contact',
        entityId: contact.id.value,
        ip: null,
        payload: {
          phoneMasked: contact.phone.masked,
          detail: 'Contato indicou número errado no inbound.',
          matchedRule: classification.matchedRule,
        },
      });
    }

    this.logger.log('Inbound na fila de atendimento', {
      conversationId: savedConversation.id,
      intent: classification.intent,
      priority: savedConversation.priority,
    });

    return this.resolved(savedConversation.id, message.id, classification.intent, false, true);
  }

  /**
   * The contact this inbound came from, tolerating the two forms a Brazilian mobile can arrive in.
   *
   * The exact match is tried first and is the normal path. The fallback exists because WhatsApp reports
   * the JID of an older account WITHOUT the ninth digit, while the same person sits in the base WITH it —
   * `+5562992238416` in `contacts`, `556292238416` on the wire. An exact-only lookup misses, and the
   * reply is discarded as a stranger writing in: silent, and indistinguishable from nobody replying.
   * That cost a long investigation, so the fallback is logged rather than quietly succeeding.
   *
   * Only the LOOKUP is tolerant. The contact keeps the number it was imported with, and the conversation
   * attaches to that same row — so the dispatch history keeps saying exactly who was messaged, and "one
   * contact, one sender" is untouched.
   */
  private async resolveContact(phone: PhoneE164): Promise<Contact | null> {
    const exact = await this.contacts.findByPhone(phone);
    if (exact) {
      return exact;
    }

    const variant = phone.brazilianNinthDigitVariant();
    if (!variant) {
      return null;
    }

    const byVariant = await this.contacts.findByPhone(variant);
    if (byVariant) {
      this.logger.log(
        `Inbound casado pelo nono dígito — recebido=${phone.masked} ` +
          `cadastrado=${variant.masked}`,
      );
    }
    return byVariant;
  }

  private ignored(reason: string): IngestResultDto {
    const dto = new IngestResultDto();
    dto.conversationId = null;
    dto.messageId = null;
    dto.intentClass = null;
    dto.autoResolved = false;
    dto.queued = false;
    dto.ignoredReason = reason;
    return dto;
  }

  private resolved(
    conversationId: string,
    messageId: string,
    intentClass: IntentClass,
    autoResolved: boolean,
    queued: boolean,
  ): IngestResultDto {
    const dto = new IngestResultDto();
    dto.conversationId = conversationId;
    dto.messageId = messageId;
    dto.intentClass = intentClass;
    dto.autoResolved = autoResolved;
    dto.queued = queued;
    dto.ignoredReason = null;
    return dto;
  }
}
