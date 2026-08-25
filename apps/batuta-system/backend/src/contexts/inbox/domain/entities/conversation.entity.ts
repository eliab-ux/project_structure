import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { ConversationPriority, ConversationStatus } from '../value-objects/conversation-status.vo';
import { IntentClass } from '../value-objects/intent-class.vo';
import { ConversationLockedException } from '../exceptions/conversation-locked.exception';

/**
 * One conversation with one contact, on one channel.
 *
 * **One row per CONTACT, never per message.** §10.1 calls this "a regra que faz ou quebra a fila": five
 * messages from the same person are ONE pending item with five messages inside it. Without that the
 * queue inflates and the operator answers the same person five times — which is worse than slow.
 *
 * The lock (§10.3 item 1) lives here rather than in a use case because its rule is about the
 * conversation's own state: whoever holds it, holds it until they release it or the TTL expires. "Dois
 * operadores respondendo o mesmo contato é pior que demora."
 */
export class Conversation extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _contactId: string,
    private _channelId: string,
    private _status: ConversationStatus,
    private _priority: ConversationPriority,
    private _intentClass: IntentClass | null,
    private _lastInboundAt: Date | null,
    private _lastOutboundAt: Date | null,
    private _lockedBy: string | null,
    private _lockedAt: Date | null,
    private _unreadCount: number,
    private _resolvedBy: string | null,
    private _resolvedAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static open(params: {
    accountId: string;
    contactId: string;
    channelId: string;
    intentClass: IntentClass | null;
    priority?: ConversationPriority;
    occurredAt?: Date;
  }): Conversation {
    const at = params.occurredAt ?? new Date();
    return new Conversation(
      randomUUID(),
      params.accountId,
      params.contactId,
      params.channelId,
      ConversationStatus.PENDING_REPLY,
      params.priority ?? ConversationPriority.NORMAL,
      params.intentClass,
      at,
      null,
      null,
      null,
      1,
      null,
      null,
      at,
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    contactId: string;
    channelId: string;
    status: ConversationStatus;
    priority: ConversationPriority;
    intentClass: IntentClass | null;
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
    lockedBy: string | null;
    lockedAt: Date | null;
    unreadCount: number;
    resolvedBy: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
  }): Conversation {
    return new Conversation(
      params.id,
      params.accountId,
      params.contactId,
      params.channelId,
      params.status,
      params.priority,
      params.intentClass,
      params.lastInboundAt,
      params.lastOutboundAt,
      params.lockedBy,
      params.lockedAt,
      params.unreadCount,
      params.resolvedBy,
      params.resolvedAt,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get contactId(): string {
    return this._contactId;
  }

  get channelId(): string {
    return this._channelId;
  }

  get status(): ConversationStatus {
    return this._status;
  }

  get priority(): ConversationPriority {
    return this._priority;
  }

  get intentClass(): IntentClass | null {
    return this._intentClass;
  }

  get lastInboundAt(): Date | null {
    return this._lastInboundAt;
  }

  get lastOutboundAt(): Date | null {
    return this._lastOutboundAt;
  }

  get lockedBy(): string | null {
    return this._lockedBy;
  }

  get lockedAt(): Date | null {
    return this._lockedAt;
  }

  get unreadCount(): number {
    return this._unreadCount;
  }

  get resolvedBy(): string | null {
    return this._resolvedBy;
  }

  get resolvedAt(): Date | null {
    return this._resolvedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /** How long the oldest unanswered message has been waiting (§10.3 item 2: "idade visível"). */
  ageInMinutes(now: Date = new Date()): number {
    const reference = this._lastInboundAt ?? this._createdAt;
    return Math.max(0, Math.floor((now.getTime() - reference.getTime()) / 60_000));
  }

  /**
   * Another inbound message arrived.
   *
   * A RESOLVED or ARCHIVED conversation REOPENS rather than spawning a second row (§10.2 item 1:
   * "cria ou reabre"). The alternative would break the one-item-per-contact rule the moment anyone
   * wrote back after being answered.
   *
   * The channel is re-pointed too: if the contact was migrated to another chip and answers on the new
   * one, the conversation belongs to the chip they are actually talking to.
   */
  registerInbound(params: {
    channelId: string;
    intentClass: IntentClass;
    highPriority: boolean;
    occurredAt: Date;
  }): void {
    this._channelId = params.channelId;
    this._intentClass = params.intentClass;
    this._lastInboundAt = params.occurredAt;
    this._unreadCount += 1;

    if (params.highPriority) {
      // Priority only ever escalates on inbound: one hostile message in a long thread keeps the item
      // at the top even if the next one is calm.
      this._priority = ConversationPriority.HIGH;
    }

    if (
      this._status === ConversationStatus.RESOLVED ||
      this._status === ConversationStatus.ARCHIVED
    ) {
      this._status = ConversationStatus.PENDING_REPLY;
      this._resolvedBy = null;
      this._resolvedAt = null;
      // The old lock is meaningless on a reopened conversation.
      this._lockedBy = null;
      this._lockedAt = null;
    }
  }

  /** An operator opened the item. Idempotent for the same operator, refused for another. */
  lock(operatorId: string, ttlMinutes: number, now: Date = new Date()): void {
    if (this.isLockedByAnother(operatorId, ttlMinutes, now)) {
      throw new ConversationLockedException(this._lockedBy as string);
    }
    this._lockedBy = operatorId;
    this._lockedAt = now;
    if (this._status === ConversationStatus.PENDING_REPLY) {
      this._status = ConversationStatus.IN_PROGRESS;
    }
    // Opening the item is what "reading" means, so the unread badge clears here.
    this._unreadCount = 0;
  }

  /**
   * Whether someone ELSE holds a live lock.
   *
   * The TTL is what makes the lock safe: an operator who closes the tab without releasing would
   * otherwise freeze that contact forever, and §10.3 says a stuck item is worse than not having the
   * queue at all.
   */
  isLockedByAnother(operatorId: string, ttlMinutes: number, now: Date = new Date()): boolean {
    if (!this._lockedBy || this._lockedBy === operatorId) {
      return false;
    }
    return !this.isLockExpired(ttlMinutes, now);
  }

  isLockExpired(ttlMinutes: number, now: Date = new Date()): boolean {
    if (!this._lockedAt) {
      return true;
    }
    return now.getTime() - this._lockedAt.getTime() > ttlMinutes * 60_000;
  }

  /** Operator closed the item without resolving it, or the TTL swept it. */
  releaseLock(): void {
    this._lockedBy = null;
    this._lockedAt = null;
    if (this._status === ConversationStatus.IN_PROGRESS) {
      this._status = ConversationStatus.PENDING_REPLY;
    }
  }

  /** A reply went out. */
  registerOutbound(sentAt: Date = new Date()): void {
    this._lastOutboundAt = sentAt;
    this._unreadCount = 0;
  }

  /** Answered and done (§10.3 item 4). */
  resolve(operatorId: string): void {
    this._status = ConversationStatus.RESOLVED;
    this._resolvedBy = operatorId;
    this._resolvedAt = new Date();
    this._lockedBy = null;
    this._lockedAt = null;
    this._unreadCount = 0;
  }

  /**
   * Closed WITHOUT a reply.
   *
   * `operatorId` is null when the classifier archived it by itself — which is what happens to every
   * acknowledgement (§10.2 item 4), and is the single biggest reason the human queue stays small.
   */
  archive(operatorId: string | null): void {
    this._status = ConversationStatus.ARCHIVED;
    this._resolvedBy = operatorId;
    this._resolvedAt = new Date();
    this._lockedBy = null;
    this._lockedAt = null;
    this._unreadCount = 0;
  }

  /** Hands the item to another operator (§10.3 item 4). The lock moves with it. */
  reassignTo(operatorId: string): void {
    this._lockedBy = operatorId;
    this._lockedAt = new Date();
    this._status = ConversationStatus.IN_PROGRESS;
  }

  /**
   * The contact was migrated to another chip (§6.4 item 6).
   *
   * Only the conversation moves. Each `messages` row keeps the `channel_id` it was actually sent or
   * received on, because rewriting those would claim a message went out from a number it never touched.
   */
  migrateToChannel(channelId: string): void {
    this._channelId = channelId;
  }
}
