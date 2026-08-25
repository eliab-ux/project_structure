import { randomUUID } from 'node:crypto';
import { MessageDirection } from '../value-objects/conversation-status.vo';
import { MessageKind } from '../value-objects/message-kind.vo';

/**
 * One message in a conversation, in either direction (§4, `messages`).
 *
 * Immutable after creation except for the delivery status: a message is a record of something that
 * happened, and editing it would make the conversation history a claim rather than evidence.
 *
 * `channelId` is stored per MESSAGE and never rewritten, including by a sender migration (§6.4 item 6).
 * That is what lets someone answer "which number spoke to this person in March?" — the conversation
 * moves to the new chip, the history keeps the truth.
 */
export class Message {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _conversationId: string,
    private readonly _contactId: string,
    private readonly _channelId: string,
    private readonly _direction: MessageDirection,
    private readonly _kind: MessageKind,
    private readonly _body: string | null,
    private readonly _mediaStorageKey: string | null,
    private _providerMessageId: string | null,
    private _deliveryStatus: string | null,
    private readonly _dispatchId: string | null,
    private readonly _sentBy: string | null,
    private readonly _occurredAt: Date,
    private readonly _createdAt: Date,
  ) {}

  /** Something the contact sent us. */
  static inbound(params: {
    accountId: string;
    conversationId: string;
    contactId: string;
    channelId: string;
    kind: MessageKind;
    body: string | null;
    mediaStorageKey: string | null;
    providerMessageId: string | null;
    occurredAt: Date;
  }): Message {
    return new Message(
      randomUUID(),
      params.accountId,
      params.conversationId,
      params.contactId,
      params.channelId,
      MessageDirection.INBOUND,
      params.kind,
      params.body,
      params.mediaStorageKey,
      params.providerMessageId,
      null,
      // Inbound has no author and no dispatch.
      null,
      null,
      params.occurredAt,
      new Date(),
    );
  }

  /**
   * Something an operator sent (§10.3 item 5: "Toda resposta enviada grava `messages` com `sent_by`").
   *
   * `sentBy` is not optional for a reply: an outbound message with no author would be unattributable,
   * and the audit trail of §11 is the reason this table has the shape it does.
   */
  static reply(params: {
    accountId: string;
    conversationId: string;
    contactId: string;
    channelId: string;
    body: string;
    sentBy: string;
    providerMessageId: string | null;
  }): Message {
    const now = new Date();
    return new Message(
      randomUUID(),
      params.accountId,
      params.conversationId,
      params.contactId,
      params.channelId,
      MessageDirection.OUTBOUND,
      MessageKind.TEXT,
      params.body,
      null,
      params.providerMessageId,
      null,
      null,
      params.sentBy,
      now,
      now,
    );
  }

  /** A campaign message, recorded so the conversation history shows what started it (§10.1). */
  static fromDispatch(params: {
    accountId: string;
    conversationId: string;
    contactId: string;
    channelId: string;
    body: string;
    dispatchId: string;
    providerMessageId: string | null;
    occurredAt: Date;
  }): Message {
    return new Message(
      randomUUID(),
      params.accountId,
      params.conversationId,
      params.contactId,
      params.channelId,
      MessageDirection.OUTBOUND,
      MessageKind.TEXT,
      params.body,
      null,
      params.providerMessageId,
      null,
      params.dispatchId,
      // No human author: it was a distribution.
      null,
      params.occurredAt,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    conversationId: string;
    contactId: string;
    channelId: string;
    direction: MessageDirection;
    kind: MessageKind;
    body: string | null;
    mediaStorageKey: string | null;
    providerMessageId: string | null;
    deliveryStatus: string | null;
    dispatchId: string | null;
    sentBy: string | null;
    occurredAt: Date;
    createdAt: Date;
  }): Message {
    return new Message(
      params.id,
      params.accountId,
      params.conversationId,
      params.contactId,
      params.channelId,
      params.direction,
      params.kind,
      params.body,
      params.mediaStorageKey,
      params.providerMessageId,
      params.deliveryStatus,
      params.dispatchId,
      params.sentBy,
      params.occurredAt,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get conversationId(): string {
    return this._conversationId;
  }

  get contactId(): string {
    return this._contactId;
  }

  get channelId(): string {
    return this._channelId;
  }

  get direction(): MessageDirection {
    return this._direction;
  }

  get kind(): MessageKind {
    return this._kind;
  }

  get body(): string | null {
    return this._body;
  }

  get mediaStorageKey(): string | null {
    return this._mediaStorageKey;
  }

  get providerMessageId(): string | null {
    return this._providerMessageId;
  }

  get deliveryStatus(): string | null {
    return this._deliveryStatus;
  }

  get dispatchId(): string | null {
    return this._dispatchId;
  }

  get sentBy(): string | null {
    return this._sentBy;
  }

  get occurredAt(): Date {
    return this._occurredAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get isInbound(): boolean {
    return this._direction === MessageDirection.INBOUND;
  }

  recordDeliveryStatus(status: string): void {
    this._deliveryStatus = status.slice(0, 40);
  }

  attachProviderMessageId(providerMessageId: string): void {
    this._providerMessageId = providerMessageId;
  }
}
