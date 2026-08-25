import { randomUUID } from 'node:crypto';
import { BlockedReason, DispatchStatus } from '../value-objects/dispatch-status.vo';
import { DispatchNotClaimableException } from '../exceptions/dispatch-not-claimable.exception';

/**
 * One send, to one contact, through one channel, with the text already resolved.
 *
 * `renderedBody` is the point of this entity existing as a row rather than being computed at send
 * time: §4 says it "guarda o texto **final**, com merge fields já resolvidos. É o que foi
 * efetivamente enviado — base da auditoria e do relatório exportável". If it were rendered during the
 * send, the exported report would be a reconstruction, and a reconstruction is not evidence.
 *
 * A dispatch never chooses its channel. It carries the one the contact already belongs to (§6.3:
 * "Sem escolha, sem fallback para outro canal") — the planner decides once, and execution obeys.
 */
export class Dispatch {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _distributionId: string,
    private readonly _contactId: string,
    private readonly _channelId: string | null,
    private readonly _variantId: string | null,
    private readonly _renderedBody: string,
    private _scheduledAt: Date | null,
    private _status: DispatchStatus,
    private _blockedReason: BlockedReason | null,
    private _attempts: number,
    private _evolutionMessageId: string | null,
    private _deliveryStatus: string | null,
    private _errorDetail: string | null,
    private _sentAt: Date | null,
    private readonly _createdAt: Date,
  ) {}

  /** A send that will be attempted. */
  static schedule(params: {
    accountId: string;
    distributionId: string;
    contactId: string;
    channelId: string;
    variantId: string | null;
    renderedBody: string;
    scheduledAt: Date;
  }): Dispatch {
    return new Dispatch(
      randomUUID(),
      params.accountId,
      params.distributionId,
      params.contactId,
      params.channelId,
      params.variantId,
      params.renderedBody,
      params.scheduledAt,
      DispatchStatus.PENDING,
      null,
      0,
      null,
      null,
      null,
      null,
      new Date(),
    );
  }

  /**
   * A send that will NOT be attempted, and says why.
   *
   * These rows exist on purpose. Not persisting them would make the preview's blocked list disappear
   * the moment the operator closed the screen, and would leave "why did these 300 people not get
   * it?" unanswerable a month later.
   *
   * It keeps `renderedBody` too: knowing what a blocked contact WOULD have received is what lets
   * someone resend it deliberately after fixing the cause.
   */
  static blocked(params: {
    accountId: string;
    distributionId: string;
    contactId: string;
    channelId: string | null;
    variantId: string | null;
    renderedBody: string;
    reason: BlockedReason;
  }): Dispatch {
    return new Dispatch(
      randomUUID(),
      params.accountId,
      params.distributionId,
      params.contactId,
      params.channelId,
      params.variantId,
      params.renderedBody,
      null,
      DispatchStatus.BLOCKED,
      params.reason,
      0,
      null,
      null,
      null,
      null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    distributionId: string;
    contactId: string;
    channelId: string | null;
    variantId: string | null;
    renderedBody: string;
    scheduledAt: Date | null;
    status: DispatchStatus;
    blockedReason: BlockedReason | null;
    attempts: number;
    evolutionMessageId: string | null;
    deliveryStatus: string | null;
    errorDetail: string | null;
    sentAt: Date | null;
    createdAt: Date;
  }): Dispatch {
    return new Dispatch(
      params.id,
      params.accountId,
      params.distributionId,
      params.contactId,
      params.channelId,
      params.variantId,
      params.renderedBody,
      params.scheduledAt,
      params.status,
      params.blockedReason,
      params.attempts,
      params.evolutionMessageId,
      params.deliveryStatus,
      params.errorDetail,
      params.sentAt,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get distributionId(): string {
    return this._distributionId;
  }

  get contactId(): string {
    return this._contactId;
  }

  get channelId(): string | null {
    return this._channelId;
  }

  get variantId(): string | null {
    return this._variantId;
  }

  get renderedBody(): string {
    return this._renderedBody;
  }

  get scheduledAt(): Date | null {
    return this._scheduledAt;
  }

  get status(): DispatchStatus {
    return this._status;
  }

  get blockedReason(): BlockedReason | null {
    return this._blockedReason;
  }

  get attempts(): number {
    return this._attempts;
  }

  get evolutionMessageId(): string | null {
    return this._evolutionMessageId;
  }

  get deliveryStatus(): string | null {
    return this._deliveryStatus;
  }

  get errorDetail(): string | null {
    return this._errorDetail;
  }

  get sentAt(): Date | null {
    return this._sentAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get isPending(): boolean {
    return this._status === DispatchStatus.PENDING;
  }

  /**
   * A worker claims the row before talking to WhatsApp (§10, FASE 7 item 3).
   *
   * The transition is here, in the entity, and not in the repository, so that "only a PENDING row can
   * be claimed" is a rule of the model rather than a property of one SQL statement. The database's
   * `FOR UPDATE SKIP LOCKED` stops two workers reaching this method for the same row; this method
   * stops the second one doing damage if they somehow do.
   */
  claim(): void {
    if (this._status !== DispatchStatus.PENDING) {
      throw new DispatchNotClaimableException(this._status);
    }
    this._status = DispatchStatus.SENDING;
    this._attempts += 1;
  }

  markSent(evolutionMessageId: string | null, sentAt: Date = new Date()): void {
    this._status = DispatchStatus.SENT;
    this._evolutionMessageId = evolutionMessageId;
    this._sentAt = sentAt;
    this._errorDetail = null;
  }

  /** Permanent failure, or a transient one that ran out of retries. */
  markFailed(detail: string): void {
    this._status = DispatchStatus.FAILED;
    // Bounded: this is an operator-facing field, not a place for a provider's stack trace.
    this._errorDetail = detail.slice(0, 500);
  }

  /** A transient failure that will be retried: back to PENDING, attempt count preserved. */
  releaseForRetry(detail: string): void {
    this._status = DispatchStatus.PENDING;
    this._errorDetail = detail.slice(0, 500);
  }

  /** Cancelled with the distribution. Only what has not gone out yet (§10, FASE 7 item 8). */
  cancel(): void {
    if (this._status === DispatchStatus.SENT) {
      // Preserving sent rows is the point of cancelling rather than deleting.
      return;
    }
    if (this._status === DispatchStatus.BLOCKED) {
      return;
    }
    this._status = DispatchStatus.CANCELLED;
  }

  /** Revalidation at execution time found a reason not to send (§10, FASE 7 item 2). */
  block(reason: BlockedReason): void {
    this._status = DispatchStatus.BLOCKED;
    this._blockedReason = reason;
    // `scheduledAt` is left as it was on purpose: it records when this send WOULD have gone out, which
    // is what makes a deliberate resend possible after the cause is fixed.
  }

  /** Delivery ack from the provider webhook. Feeds `delivery_rate`, which drives the throttle. */
  recordDeliveryStatus(status: string): void {
    this._deliveryStatus = status.slice(0, 40);
  }

  /**
   * A migration re-points a pending send to the contact's new channel (§6.4 item 5).
   *
   * Only PENDING rows: a sent message went out from the old chip and rewriting its channel would be
   * falsifying history.
   */
  reassignChannel(channelId: string): Dispatch {
    if (this._status !== DispatchStatus.PENDING) {
      return this;
    }
    return new Dispatch(
      this._id,
      this._accountId,
      this._distributionId,
      this._contactId,
      channelId,
      this._variantId,
      this._renderedBody,
      this._scheduledAt,
      this._status,
      this._blockedReason,
      this._attempts,
      this._evolutionMessageId,
      this._deliveryStatus,
      this._errorDetail,
      this._sentAt,
      this._createdAt,
    );
  }
}
