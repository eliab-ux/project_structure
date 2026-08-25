import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
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
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../../../audience/application/ports/output/contact-repository.port';
import { ContactId } from '../../../../audience/domain/value-objects/contact-id.vo';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../../../content/application/ports/output/content-repository.port';
import { Content } from '../../../../content/domain/entities/content.entity';
import { MediaAsset } from '../../../../content/domain/entities/media-asset.entity';
import { MediaKind } from '../../../../content/domain/value-objects/media-kind.vo';
import { ContentId } from '../../../../content/domain/value-objects/content-id.vo';
import {
  DISPATCH_REPOSITORY,
  DISTRIBUTION_REPOSITORY,
  DispatchRepositoryPort,
  DistributionRepositoryPort,
} from '../../../../distribution/application/ports/output/distribution-repositories.port';
import {
  BlockedReason,
  DispatchStatus,
} from '../../../../distribution/domain/value-objects/dispatch-status.vo';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import {
  WHATSAPP_GATEWAY,
  WhatsAppGatewayPort,
  GatewaySendResult,
} from '../../../../../infrastructure/whatsapp/ports/whatsapp-gateway.port';
import {
  FILE_STORAGE,
  FileStoragePort,
} from '../../../../../infrastructure/storage/ports/file-storage.port';
import { GatewayPermanentException } from '../../../../../infrastructure/whatsapp/exceptions/gateway.exception';
import { ThrottleConfig } from '../../../../../config/throttle.config';
import { DistributionConfig } from '../../../../../config/distribution.config';
import { localDateKey } from '../../../../../shared/domain/services/zoned-time';
import { FailureKind } from '../../../domain/value-objects/failure-kind.vo';
import { ExecuteDispatchCommand } from './execute-dispatch.command';

export class DispatchOutcomeDto {
  dispatchId!: string;
  /** SENT, BLOCKED, FAILED, RETRY or DEFERRED. */
  outcome!: 'SENT' | 'BLOCKED' | 'FAILED' | 'RETRY' | 'DEFERRED';
  blockedReason!: BlockedReason | null;
  providerMessageId!: string | null;
  /** True when the worker should let BullMQ retry this job. */
  retryable!: boolean;
  /**
   * Only on DEFERRED: how long the worker must push this job back by.
   *
   * DEFERRED is NOT a failure and must not be treated as one — no attempt consumed, no circuit
   * breaker, no contribution to the throttle's failure rate. The channel simply sent too recently.
   */
  retryAfterMs!: number;
  detail!: string | null;
}

/**
 * Outcome of the pre-send checks. `content` is present exactly when nothing blocks, so the send path
 * cannot reach for an aggregate that was never validated.
 */
type Revalidation =
  | { blocked: { reason: BlockedReason; detail: string }; content: null }
  | { blocked: null; content: Content };

/**
 * Sends ONE message (§10, FASE 7).
 *
 * The shape of this method is the phase's whole point: **nothing is assumed from the planning step**
 * (item 2). Between the plan and this moment — which may be days, since a 10k base takes about a week
 * (§15 risco 3) — the account can be suspended, the content can lose its approval, the chip can drop,
 * the quota can be recalculated downwards, and the contact can ask to be removed. Every one of those
 * is re-checked here, and each produces a BLOCKED row with its reason rather than a silent skip.
 *
 * The order of the checks is cheapest-and-most-decisive first, and it also mirrors severity: an
 * account suspension stops everything, an opt-out stops this contact forever, a quota ceiling stops
 * this send today.
 *
 * What this use case deliberately does NOT do:
 *  - **decide the channel.** It sends through `dispatch.channelId`, the sender the contact belongs to
 *    (§6.3). If that chip cannot send, the message does not go out through another one.
 *  - **re-render the text.** `renderedBody` was frozen at planning time and is the audit evidence
 *    (§4). Re-rendering here would make the exported report a reconstruction.
 *  - **promote a channel to a terminal state.** The circuit breaker degrades; only a human bans
 *    (§4, semântica dos estados).
 */
@Injectable()
export class ExecuteDispatchUseCase implements UseCase<ExecuteDispatchCommand, DispatchOutcomeDto> {
  private readonly logger = new Logger(ExecuteDispatchUseCase.name);

  constructor(
    @Inject(DISPATCH_REPOSITORY) private readonly dispatches: DispatchRepositoryPort,
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(CHANNEL_DAILY_COUNTER_REPOSITORY)
    private readonly counters: ChannelDailyCounterRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly throttleConfig: ThrottleConfig,
    private readonly distributionConfig: DistributionConfig,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ExecuteDispatchCommand): Promise<DispatchOutcomeDto> {
    const deferral = await this.enforceSendInterval(command);
    if (deferral) {
      return deferral;
    }

    // The claim is atomic: SELECT ... FOR UPDATE SKIP LOCKED then UPDATE to SENDING in one
    // transaction (item 3). Null means another worker already has it, or it is no longer PENDING —
    // both of which mean this job has nothing to do, which is exactly what idempotency looks like.
    const dispatch = await this.dispatches.claimDue({
      accountId: command.accountId,
      dispatchId: command.dispatchId,
    });
    if (!dispatch) {
      return this.outcome(command.dispatchId, 'SENT', {
        detail: 'Já processado ou reivindicado por outro worker.',
      });
    }

    try {
      const revalidation = await this.revalidate(command, dispatch.channelId, dispatch.contactId);
      const blocked = revalidation.blocked;
      if (blocked) {
        dispatch.block(blocked.reason);
        await this.dispatches.save(dispatch);
        this.logger.warn('Envio bloqueado na revalidação', {
          dispatchId: dispatch.id,
          reason: blocked.reason,
        });
        return this.outcome(dispatch.id, 'BLOCKED', {
          blockedReason: blocked.reason,
          detail: blocked.detail,
        });
      }

      const channelId = dispatch.channelId as string;
      const channel = await this.channels.findById(ChannelId.from(channelId));
      const contact = await this.contacts.findById(ContactId.from(dispatch.contactId));
      if (!channel || !contact) {
        // revalidate() already covers both; this keeps the types honest without a non-null assertion.
        dispatch.block(BlockedReason.SENDER_UNAVAILABLE);
        await this.dispatches.save(dispatch);
        return this.outcome(dispatch.id, 'BLOCKED', {
          blockedReason: BlockedReason.SENDER_UNAVAILABLE,
        });
      }

      /**
       * The attachment is fetched BEFORE the quota is reserved.
       *
       * If MinIO is unreachable this throws, and the outer catch releases the row for a retry without
       * having consumed a unit of quota and without counting a failure against the chip — the storage
       * is what is broken, not the sender. Reserving first would burn quota on every attempt during an
       * outage, and routing it through `handleSendFailure` would degrade a perfectly healthy channel.
       */
      const attachment = revalidation.content
        ? await this.loadAttachment(command.accountId, revalidation.content, dispatch.variantId)
        : null;

      /**
       * Quota is reserved BEFORE the send, not after.
       *
       * The order matters and the asymmetry is deliberate: if the increment came after a successful
       * send, two workers could both pass the ceiling check, both send, and the channel would exceed
       * its quota — the exact race item 5 exists to prevent. Incrementing first means a send that then
       * fails has consumed one unit of quota it did not use. That is the safe direction to be wrong in:
       * under-sending by one costs nothing, over-sending costs the chip.
       */
      const today = localDateKey(new Date(), command.timeZone);
      const afterIncrement = await this.counters.incrementCampaignSend(
        command.accountId,
        channelId,
        today,
      );
      if (afterIncrement > channel.quota.current) {
        dispatch.block(BlockedReason.QUOTA_EXCEEDED);
        await this.dispatches.save(dispatch);
        this.logger.warn('Envio bloqueado por cota', {
          dispatchId: dispatch.id,
          channelId,
          afterIncrement,
          quota: channel.quota.current,
        });
        return this.outcome(dispatch.id, 'BLOCKED', {
          blockedReason: BlockedReason.QUOTA_EXCEEDED,
          detail: `Cota do canal atingida (${afterIncrement}/${channel.quota.current}).`,
        });
      }

      try {
        const instance = {
          instanceName: channel.evolutionInstanceName,
          accountId: command.accountId,
        };
        // Digits only: a JID carries no plus sign.
        const toDigits = contact.phone.value.replace(/\D/g, '');

        /**
         * One message, whatever it carries: media travels WITH the text as its caption, never as a
         * second send. Two sends per contact would double the real volume behind a counter that only
         * counted one, which is the chip's problem, not the report's.
         */
        const result: GatewaySendResult = attachment
          ? await this.sendAttachment(instance, toDigits, dispatch.renderedBody, attachment)
          : await this.gateway.sendText({ instance, toDigits, text: dispatch.renderedBody });

        dispatch.markSent(result.providerMessageId);
        await this.dispatches.save(dispatch);

        channel.registerSendSuccess();
        await this.channels.save(channel);
        await this.events.publishAll(channel.pullDomainEvents());

        // First send flips the distribution to RUNNING, so "em andamento" means something.
        const distribution = await this.distributions.findById(dispatch.distributionId);
        if (distribution && distribution.status === 'PLANNED') {
          distribution.markRunning();
          await this.distributions.save(distribution);
        }

        this.logger.log('Envio realizado', {
          dispatchId: dispatch.id,
          channelId,
          mediaKind: attachment?.asset.kind ?? null,
          // Never the phone, never the body (§16).
        });

        return this.outcome(dispatch.id, 'SENT', { providerMessageId: result.providerMessageId });
      } catch (error) {
        return this.handleSendFailure(command, dispatch, channel, error);
      }
    } catch (error) {
      // Anything unexpected: release the row so a retry can pick it up rather than leaving it stuck
      // in SENDING forever.
      dispatch.releaseForRetry((error as Error)?.message ?? 'erro inesperado');
      await this.dispatches.save(dispatch);
      throw error;
    }
  }

  /**
   * The runtime half of the pacing (Adendo 02 §1).
   *
   * The spacing between sends of one channel was, until here, expressed ONLY as the BullMQ job delay
   * computed at planning time — a promise that holds exactly as long as the queue never falls behind.
   * A deploy, a restart or a crash (routine on Dokploy) leaves the jobs due and piled up, and they all
   * become ready at the same instant. Serialising them does not space them: at one or two seconds per
   * send, a hundred queued messages leave the chip in three minutes. So the interval is enforced again
   * here, against the clock, where it cannot be a promise.
   *
   * It runs BEFORE `claimDue` for two concrete reasons:
   *  - claiming increments `attempts`, and a deferral must not consume one;
   *  - the channel is re-read afterwards, so the aggregate that gets saved later carries the
   *    reservation instead of overwriting it with the value it had before.
   *
   * @returns a DEFERRED outcome when the channel must wait, or null when it may send.
   */
  private async enforceSendInterval(
    command: ExecuteDispatchCommand,
  ): Promise<DispatchOutcomeDto | null> {
    const pending = await this.dispatches.findById(command.dispatchId);
    // Not claimable: no slot is taken, and `claimDue` will report it as already processed.
    if (!pending || pending.status !== DispatchStatus.PENDING || !pending.channelId) {
      return null;
    }

    const slot = await this.channels.reserveSendSlot({
      channelId: pending.channelId,
      minIntervalSeconds: this.distributionConfig.minIntervalSeconds,
    });
    if (slot.allowed) {
      return null;
    }

    this.logger.debug('Envio adiado pelo intervalo mínimo do canal', {
      dispatchId: command.dispatchId,
      channelId: pending.channelId,
      waitMs: slot.waitMs,
    });
    return this.outcome(command.dispatchId, 'DEFERRED', {
      retryAfterMs: slot.waitMs,
      detail: `Intervalo mínimo do canal não decorrido; faltam ${slot.waitMs} ms.`,
    });
  }

  /**
   * The five runtime checks of item 2, in order of how much they stop.
   *
   * It returns the revalidated content along with the verdict rather than just a reason, because the
   * send needs the aggregate anyway (its media is part of the message) and loading it twice would
   * open a window where the copy that was checked is not the copy that is sent.
   */
  private async revalidate(
    command: ExecuteDispatchCommand,
    channelId: string | null,
    contactId: string,
  ): Promise<Revalidation> {
    const account = await this.accounts.findById(AccountId.from(command.accountId));
    if (!account || !account.canDispatch) {
      return ExecuteDispatchUseCase.blockedBy(
        BlockedReason.ACCOUNT_SUSPENDED,
        account?.suspensionReason ?? 'Conta suspensa.',
      );
    }

    const distribution = await this.distributions.findById(command.distributionId);
    if (!distribution || !distribution.isDispatchable) {
      // Paused or cancelled between planning and now. Not an error: the operator asked for it.
      return ExecuteDispatchUseCase.blockedBy(
        BlockedReason.CONTENT_NOT_APPROVED,
        `Distribuição está em ${distribution?.status ?? 'estado desconhecido'}.`,
      );
    }

    const content = await this.contents.findById(ContentId.from(distribution.contentId));
    if (!content || !content.isDispatchable) {
      // §8.5: an edit after approval sends the content back to DRAFT. Sending anyway would violate
      // the non-negotiable rule of §1.4.
      return ExecuteDispatchUseCase.blockedBy(
        BlockedReason.CONTENT_NOT_APPROVED,
        `Conteúdo está em ${content?.status ?? 'estado desconhecido'}.`,
      );
    }

    const contact = await this.contacts.findById(ContactId.from(contactId));
    if (!contact) {
      return ExecuteDispatchUseCase.blockedBy(
        BlockedReason.CONTACT_INACTIVE,
        'Contato não existe mais.',
      );
    }
    if (contact.hasOptedOut) {
      // The one check that must never be wrong: an opt-out is irreversible by design (§6.5).
      return ExecuteDispatchUseCase.blockedBy(
        BlockedReason.CONTACT_OPTED_OUT,
        'Contato pediu para sair.',
      );
    }
    if (!contact.active) {
      return ExecuteDispatchUseCase.blockedBy(BlockedReason.CONTACT_INACTIVE, 'Contato inativo.');
    }

    if (!channelId) {
      return ExecuteDispatchUseCase.blockedBy(
        BlockedReason.SENDER_UNAVAILABLE,
        'Envio sem remetente.',
      );
    }
    const channel = await this.channels.findById(ChannelId.from(channelId));
    if (!channel) {
      return ExecuteDispatchUseCase.blockedBy(
        BlockedReason.SENDER_UNAVAILABLE,
        'Remetente não existe mais.',
      );
    }
    if (!channel.canSend) {
      return ExecuteDispatchUseCase.blockedBy(
        BlockedReason.SENDER_UNAVAILABLE,
        `Remetente "${channel.label}" está ${channel.status}.`,
      );
    }

    return { blocked: null, content };
  }

  private static blockedBy(reason: BlockedReason, detail: string): Revalidation {
    return { blocked: { reason, detail }, content: null };
  }

  /**
   * Reads the attachment this dispatch carries, or null when the message is text only.
   *
   * The bytes come from storage on every send rather than riding along in the job payload: a 16 MB
   * video base64-encoded into Redis, once per contact, would put the whole campaign in the queue's
   * memory. The trade is one read per send, which is what object storage is for.
   *
   * `findAttachmentProblems` already refused, at planning time, anything that does not fit in one
   * message. Reaching here with more than one asset means the content changed after the plan — which
   * also invalidated its approval, so the dispatch would have been blocked before this point. The
   * first asset is used and the anomaly is logged loudly rather than throwing: at this stage the
   * message is going out either way, and sending it with one of its images beats sending it bare.
   */
  private async loadAttachment(
    accountId: string,
    content: Content,
    variantId: string | null,
  ): Promise<{ asset: MediaAsset; base64: string } | null> {
    const media = content.mediaFor(variantId);
    if (media.length === 0) {
      return null;
    }
    if (media.length > 1) {
      this.logger.error(
        'Conteúdo com mais de uma mídia no envio — apenas a primeira será enviada',
        {
          contentId: content.id.value,
          variantId,
          mediaCount: media.length,
        },
      );
    }

    const asset = media[0];
    const buffer = await this.storage.getObject(accountId, asset.storageKey);
    return { asset, base64: buffer.toString('base64') };
  }

  private async sendAttachment(
    instance: { instanceName: string; accountId: string },
    toDigits: string,
    caption: string,
    attachment: { asset: MediaAsset; base64: string },
  ): Promise<GatewaySendResult> {
    const input = {
      instance,
      toDigits,
      base64: attachment.base64,
      mimeType: attachment.asset.mimeType,
      fileName: attachment.asset.originalName,
      caption,
    };

    // A document is not an image with a different mime: WhatsApp renders it as a file card, and
    // sending a PDF through sendMedia produces an unopenable attachment on some clients.
    return attachment.asset.kind === MediaKind.DOCUMENT
      ? this.gateway.sendDocument(input)
      : this.gateway.sendMedia(input);
  }

  /**
   * Failure handling (§10, FASE 7 items 6 and 7).
   *
   * Transient → back to PENDING and let BullMQ retry with backoff. Permanent → FAILED at once, and
   * the contact is flagged for review, because a number that is not on WhatsApp will fail forever and
   * keeping it in the rotation drags the channel's delivery rate down — which the throttle reads as
   * blocking and answers by cutting the quota of a healthy chip.
   *
   * Either way the failure counts towards the circuit breaker, which DEGRADES the channel and stops
   * one step short of terminal.
   */
  private async handleSendFailure(
    command: ExecuteDispatchCommand,
    dispatch: import('../../../../distribution/domain/entities/dispatch.entity').Dispatch,
    channel: import('../../../../channel/domain/entities/channel.entity').Channel,
    error: unknown,
  ): Promise<DispatchOutcomeDto> {
    // Permanent is the narrow case and must be PROVEN by the adapter's own classification; anything
    // unrecognised is treated as transient, because giving up on a real recipient is worse than one
    // extra attempt.
    const permanent = error instanceof GatewayPermanentException;
    const kind = permanent ? FailureKind.PERMANENT : FailureKind.TRANSIENT;
    const detail = permanent
      ? `${error.operation}: ${error.detail}`
      : ((error as Error)?.message ?? 'falha desconhecida');

    const tripped = channel.registerSendFailure(this.throttleConfig.circuitBreakerFailureThreshold);
    await this.channels.save(channel);
    await this.events.publishAll(channel.pullDomainEvents());

    if (tripped) {
      this.logger.error('Circuit breaker abriu: canal degradado', {
        channelId: channel.id.value,
        consecutiveFailures: channel.consecutiveFailures,
      });
      await this.audit.execute({
        accountId: command.accountId,
        actorType: AuditActorType.SYSTEM,
        actorId: null,
        action: AuditAction.CHANNEL_DEGRADED,
        entityType: 'channel',
        entityId: channel.id.value,
        ip: null,
        payload: {
          reason: 'CIRCUIT_BREAKER',
          consecutiveFailures: channel.consecutiveFailures,
          threshold: this.throttleConfig.circuitBreakerFailureThreshold,
        },
      });
    }

    if (kind === FailureKind.PERMANENT) {
      dispatch.markFailed(detail);
      await this.dispatches.save(dispatch);

      const contact = await this.contacts.findById(ContactId.from(dispatch.contactId));
      if (contact) {
        // Out of routing, not deleted. The reason goes to the audit trail because `contacts` has no
        // review column (§4) — see Contact.flagForReview.
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
          // Masked phone: the trail says which contact without printing the number (§16).
          payload: { phoneMasked: contact.phone.masked, detail, dispatchId: dispatch.id },
        });
      }

      return this.outcome(dispatch.id, 'FAILED', { detail, retryable: false });
    }

    dispatch.releaseForRetry(detail);
    await this.dispatches.save(dispatch);
    return this.outcome(dispatch.id, 'RETRY', { detail, retryable: true });
  }

  private outcome(
    dispatchId: string,
    outcome: DispatchOutcomeDto['outcome'],
    extra: Partial<Omit<DispatchOutcomeDto, 'dispatchId' | 'outcome'>> = {},
  ): DispatchOutcomeDto {
    const dto = new DispatchOutcomeDto();
    dto.dispatchId = dispatchId;
    dto.outcome = outcome;
    dto.blockedReason = extra.blockedReason ?? null;
    dto.providerMessageId = extra.providerMessageId ?? null;
    dto.retryable = extra.retryable ?? false;
    dto.retryAfterMs = extra.retryAfterMs ?? 0;
    dto.detail = extra.detail ?? null;
    return dto;
  }
}
