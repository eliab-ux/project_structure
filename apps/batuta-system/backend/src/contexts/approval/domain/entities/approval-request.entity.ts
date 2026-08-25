import { randomUUID } from 'crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { ApprovalRequestStatus, isOpen } from '../value-objects/approval-status.vo';
import { IssuedApprovalToken, issueApprovalToken } from '../value-objects/approval-token.vo';
import { InvalidApprovalTokenException } from '../exceptions/invalid-approval-token.exception';
import { ApprovalDecidedEvent } from '../events/approval-decided.event';

/** Free-text comment bound so a decision cannot carry an essay into the trail. */
const MAX_COMMENT = 1000;

export interface ApprovalDecisionContext {
  /** Recorded because §8 item 4 wants the record to be defensible: who, when, from where. */
  ip: string | null;
  userAgent: string | null;
  comment: string | null;
}

/**
 * One approver's pending decision on one exact version of a content (§8 item 4).
 *
 * The pairing with `content_hash` is what makes the record worth anything: the request is not "Ana
 * approved this content", it is "Ana approved THIS VERSION, at this time, from this IP". If the
 * content changes, the request is INVALIDATED rather than silently carried over (§8.5).
 *
 * The token is stored as a hash; the plaintext exists only in the link that went out.
 */
export class ApprovalRequest extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _contentId: string,
    private readonly _contentHash: string,
    private readonly _approverId: string,
    private readonly _tokenHash: string,
    private readonly _expiresAt: Date,
    private _status: ApprovalRequestStatus,
    private _decidedAt: Date | null,
    private _decidedIp: string | null,
    private _decidedUserAgent: string | null,
    private _comment: string | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  /** @returns the request AND the plaintext token, which the caller puts in the link and forgets. */
  static issue(params: {
    accountId: string;
    contentId: string;
    contentHash: string;
    approverId: string;
    ttlHours: number;
  }): { request: ApprovalRequest; token: IssuedApprovalToken } {
    const token = issueApprovalToken();
    const request = new ApprovalRequest(
      randomUUID(),
      params.accountId,
      params.contentId,
      params.contentHash,
      params.approverId,
      token.hash,
      new Date(Date.now() + params.ttlHours * 60 * 60 * 1000),
      ApprovalRequestStatus.PENDING,
      null,
      null,
      null,
      null,
      new Date(),
    );

    return { request, token };
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    contentId: string;
    contentHash: string;
    approverId: string;
    tokenHash: string;
    expiresAt: Date;
    status: ApprovalRequestStatus;
    decidedAt: Date | null;
    decidedIp: string | null;
    decidedUserAgent: string | null;
    comment: string | null;
    createdAt: Date;
  }): ApprovalRequest {
    return new ApprovalRequest(
      params.id,
      params.accountId,
      params.contentId,
      params.contentHash,
      params.approverId,
      params.tokenHash,
      params.expiresAt,
      params.status,
      params.decidedAt,
      params.decidedIp,
      params.decidedUserAgent,
      params.comment,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get contentId(): string {
    return this._contentId;
  }

  /** The exact version this decision refers to. */
  get contentHash(): string {
    return this._contentHash;
  }

  get approverId(): string {
    return this._approverId;
  }

  /** Only the repository reads this, to look a token up. Never returned over HTTP. */
  tokenHashForPersistence(): string {
    return this._tokenHash;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get status(): ApprovalRequestStatus {
    return this._status;
  }

  get decidedAt(): Date | null {
    return this._decidedAt;
  }

  get decidedIp(): string | null {
    return this._decidedIp;
  }

  get decidedUserAgent(): string | null {
    return this._decidedUserAgent;
  }

  get comment(): string | null {
    return this._comment;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get isPending(): boolean {
    return isOpen(this._status);
  }

  isExpiredAt(now: Date = new Date()): boolean {
    return this._expiresAt.getTime() <= now.getTime();
  }

  /**
   * Whether this link can still be used to decide.
   *
   * Checks the three ways it dies: already decided (single use), TTL, and the content having moved on.
   * The hash comparison is what makes the link safe to leave in an inbox: it stops being usable the
   * moment the text changes.
   */
  assertUsable(currentContentHash: string, now: Date = new Date()): void {
    if (
      this._status === ApprovalRequestStatus.APPROVED ||
      this._status === ApprovalRequestStatus.REJECTED
    ) {
      throw new InvalidApprovalTokenException('esta decisão já foi registrada.');
    }
    if (this._status === ApprovalRequestStatus.INVALIDATED) {
      throw new InvalidApprovalTokenException('o conteúdo foi editado depois do envio.');
    }
    if (this._status === ApprovalRequestStatus.EXPIRED || this.isExpiredAt(now)) {
      throw new InvalidApprovalTokenException('o prazo do link terminou.');
    }
    if (this._contentHash !== currentContentHash) {
      // Belt and braces: the invalidation handler should already have caught this.
      throw new InvalidApprovalTokenException('o conteúdo foi editado depois do envio.');
    }
  }

  approve(context: ApprovalDecisionContext): void {
    this.recordDecision(ApprovalRequestStatus.APPROVED, context);
  }

  reject(context: ApprovalDecisionContext): void {
    this.recordDecision(ApprovalRequestStatus.REJECTED, context);
  }

  /** TTL ran out. Terminal, and distinct from a rejection: nobody said no. */
  markExpired(): void {
    if (!this.isPending) {
      return;
    }
    this._status = ApprovalRequestStatus.EXPIRED;
  }

  /**
   * The content changed underneath this request (§8.5). Terminal, and NOT a rejection — the thing that
   * was reviewed stopped existing, which is a different fact for the trail.
   */
  invalidate(): void {
    if (!this.isPending) {
      return;
    }
    this._status = ApprovalRequestStatus.INVALIDATED;
  }

  private recordDecision(
    status: ApprovalRequestStatus.APPROVED | ApprovalRequestStatus.REJECTED,
    context: ApprovalDecisionContext,
  ): void {
    this._status = status;
    this._decidedAt = new Date();
    this._decidedIp = context.ip;
    this._decidedUserAgent = context.userAgent?.slice(0, 300) ?? null;
    this._comment = context.comment?.trim().slice(0, MAX_COMMENT) || null;

    this.addDomainEvent(
      new ApprovalDecidedEvent(
        this._accountId,
        this._contentId,
        this._id,
        this._approverId,
        status,
        this._contentHash,
        this._comment,
      ),
    );
  }
}
