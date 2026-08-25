import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../../../audience/application/ports/output/contact-repository.port';
import { ContactId } from '../../../../audience/domain/value-objects/contact-id.vo';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../../../channel/application/ports/output/channel-repository.port';
import {
  CHANNEL_DAILY_COUNTER_REPOSITORY,
  ChannelDailyCounterRepositoryPort,
} from '../../../../channel/application/ports/output/channel-signals.port';
import { ChannelId } from '../../../../channel/domain/value-objects/channel-id.vo';
import {
  WHATSAPP_GATEWAY,
  WhatsAppGatewayPort,
} from '../../../../../infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { localDateKey } from '../../../../../shared/domain/services/zoned-time';
import { Message } from '../../../domain/entities/message.entity';
import { ConversationNotFoundException } from '../../../domain/exceptions/conversation-not-found.exception';
import { ConversationLockedException } from '../../../domain/exceptions/conversation-locked.exception';
import { ReplyNotPossibleException } from '../../../domain/exceptions/reply-not-possible.exception';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepositoryPort,
  MESSAGE_REPOSITORY,
  MessageRepositoryPort,
  QUICK_REPLY_REPOSITORY,
  QuickReplyRepositoryPort,
} from '../../ports/output/inbox-repositories.port';
import { InboxConfig } from '../../../../../config/inbox.config';
import { SendReplyCommand } from './send-reply.command';

export class ReplyResultDto {
  conversationId!: string;
  messageId!: string;
  channelId!: string;
  /** `reply_sends` for this channel today, AFTER this reply. */
  replySendsToday!: number;
  sentAt!: Date;
}

/**
 * Sends an operator's reply (§10.4).
 *
 * Three rules, and each one exists against a specific temptation:
 *
 *  1. **It goes out through the conversation's own channel.** The operator does not choose and does not
 *     need to know which chip it is — "o chip que o contato conhece". Letting them pick would let a
 *     reply arrive from a number the contact never saw, which reads as a scam.
 *  2. **It uses the reply band of the quota, not the campaign band.** `reply_sends` is a separate
 *     counter for a reason: a busy inbox must not silently eat the campaign's allowance, and a campaign
 *     must not starve replies. The planner already reserves a share of every chip for this (§9.2).
 *  3. **No jitter, no scheduling.** The spec is explicit: "Segurar resposta por horas para respeitar
 *     intervalo de disparo destrói o propósito." A reply is synchronous — the operator waits for it and
 *     the contact is on the other side.
 *
 * The reply DOES respect the channel's total daily quota, because a chip that has already sent its
 * maximum is a chip at risk regardless of which band the next message comes from. What it does not do is
 * queue behind the campaign.
 *
 * Quiet hours are deliberately NOT enforced here. A person who wrote at 22:30 is awake and waiting;
 * refusing to answer them until 08:00 would be the system protecting itself at the contact's expense.
 * The quiet-hours rule exists for unsolicited campaign traffic, which is a different act.
 */
@Injectable()
export class SendReplyUseCase implements UseCase<SendReplyCommand, ReplyResultDto> {
  private readonly logger = new Logger(SendReplyUseCase.name);

  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepositoryPort,
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(CHANNEL_DAILY_COUNTER_REPOSITORY)
    private readonly counters: ChannelDailyCounterRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
    @Inject(QUICK_REPLY_REPOSITORY) private readonly quickReplies: QuickReplyRepositoryPort,
    private readonly config: InboxConfig,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: SendReplyCommand): Promise<ReplyResultDto> {
    const conversation = await this.conversations.findById(command.conversationId);
    if (!conversation) {
      throw new ConversationNotFoundException();
    }

    // The lock is what stops two operators answering the same person (§10.3 item 1). Sending without
    // holding it would defeat the whole mechanism, so it is checked here and not only when opening.
    if (conversation.isLockedByAnother(command.performedBy, this.config.lockTtlMinutes)) {
      throw new ConversationLockedException(conversation.lockedBy as string);
    }

    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account || !account.canDispatch) {
      throw new ReplyNotPossibleException('a conta está suspensa.');
    }

    const contact = await this.contacts.findById(ContactId.from(conversation.contactId));
    if (!contact) {
      throw new ReplyNotPossibleException('o contato não existe mais.');
    }
    // An opted-out contact is NOT replied to, even by a human: §6.5 makes the opt-out irreversible, and
    // "but the operator meant well" is not an exception the contact agreed to.
    if (contact.hasOptedOut) {
      throw new ReplyNotPossibleException('este contato pediu para não receber mais mensagens.');
    }

    const channel = await this.channels.findById(ChannelId.from(conversation.channelId));
    if (!channel) {
      throw new ReplyNotPossibleException('o canal desta conversa não existe mais.');
    }
    if (!channel.canSend) {
      // No fallback to another chip: see rule 1 in the class docblock.
      throw new ReplyNotPossibleException(
        `o canal "${channel.label}" está ${channel.status}. A resposta precisa sair pelo mesmo número que falou com o contato.`,
      );
    }

    const timeZone = account.timezone || 'America/Sao_Paulo';
    const today = localDateKey(new Date(), timeZone);
    const usage = await this.counters.findForChannelAndDate(channel.id.value, today);
    if (usage.campaignSends + usage.replySends >= channel.quota.current) {
      // The reply band is prioritised, not unlimited: a chip at its daily total is at risk whatever the
      // next message is for.
      throw new ReplyNotPossibleException(
        `o canal "${channel.label}" atingiu a cota do dia (${channel.quota.current}). ` +
          'Aumente a faixa do canal ou responda amanhã.',
      );
    }

    const result = await this.gateway.sendText({
      instance: { instanceName: channel.evolutionInstanceName, accountId: command.accountId },
      toDigits: contact.phone.value.replace(/\D/g, ''),
      text: command.body,
    });

    // Counted in the REPLY band (§10.4), atomically like the campaign one.
    const replySendsToday = await this.counters.incrementReplySend(
      command.accountId,
      channel.id.value,
      today,
    );

    const message = await this.messages.save(
      Message.reply({
        accountId: command.accountId,
        conversationId: conversation.id,
        contactId: contact.id.value,
        channelId: channel.id.value,
        body: command.body,
        // §10.3 item 5: every reply records who sent it.
        sentBy: command.performedBy,
        providerMessageId: result.providerMessageId,
      }),
    );

    conversation.registerOutbound(message.occurredAt);
    if (command.resolve) {
      conversation.resolve(command.performedBy);
    }
    await this.conversations.save(conversation);

    channel.registerSendSuccess(message.occurredAt);
    await this.channels.save(channel);
    channel.pullDomainEvents();

    if (command.quickReplyId) {
      const quickReply = await this.quickReplies.findById(command.quickReplyId);
      if (quickReply) {
        // Counted so the library can be ordered by what actually gets used.
        quickReply.registerUsage();
        await this.quickReplies.save(quickReply);
      }
    }

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.INBOX_REPLY_SENT,
      entityType: 'conversation',
      entityId: conversation.id,
      ip: command.ip,
      // The body is NOT in the payload: §16 forbids logging message bodies, and the text is already in
      // `messages`, which is the right place for it. What belongs here is who answered whom, and when.
      payload: {
        contactId: contact.id.value,
        channelId: channel.id.value,
        messageId: message.id,
        bodyLength: command.body.length,
        usedQuickReply: Boolean(command.quickReplyId),
        resolved: command.resolve,
      },
    });

    this.logger.log('Resposta enviada', {
      conversationId: conversation.id,
      channelId: channel.id.value,
      replySendsToday,
    });

    const dto = new ReplyResultDto();
    dto.conversationId = conversation.id;
    dto.messageId = message.id;
    dto.channelId = channel.id.value;
    dto.replySendsToday = replySendsToday;
    dto.sentAt = message.occurredAt;
    return dto;
  }
}
