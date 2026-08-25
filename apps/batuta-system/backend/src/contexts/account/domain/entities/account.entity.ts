import { AggregateRoot } from '@gitspread/domain-primitives';
import { AccountId } from '../value-objects/account-id.vo';
import { AccountPlan } from '../value-objects/account-plan.vo';
import { AccountStatus, canDispatch } from '../value-objects/account-status.vo';
import { Document } from '../value-objects/document.vo';
import { DailyCeilingExceededException } from '../exceptions/daily-ceiling-exceeded.exception';
import { InvalidSendCeilingException } from '../exceptions/invalid-send-ceiling.exception';
import { AccountSuspendedEvent } from '../events/account-suspended.event';
import { AccountReactivatedEvent } from '../events/account-reactivated.event';

/**
 * A tenant. Pure domain — no framework, no ORM.
 *
 * Two invariants live here and nowhere else:
 *  - the account-wide daily ceiling PREVAILS over the sum of channel quotas (§9.2);
 *  - a suspended account never dispatches, but its users still log in (§5, FASE 1 item 6).
 */
export class Account extends AggregateRoot {
  private constructor(
    private readonly _id: AccountId,
    private _name: string,
    private _document: Document,
    private _plan: AccountPlan,
    private _status: AccountStatus,
    private _dailySendCeiling: number,
    private _timezone: string,
    private _evolutionServerUrl: string | null,
    private _evolutionApiKey: string | null,
    private _suspendedAt: Date | null,
    private _suspensionReason: string | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    name: string;
    document: Document;
    plan: AccountPlan;
    dailySendCeiling: number;
    timezone: string;
    status?: AccountStatus;
  }): Account {
    Account.assertValidCeiling(params.dailySendCeiling);

    return new Account(
      AccountId.generate(),
      params.name.trim(),
      params.document,
      params.plan,
      params.status ?? AccountStatus.TRIAL,
      params.dailySendCeiling,
      params.timezone,
      null,
      null,
      null,
      null,
      new Date(),
    );
  }

  /** Rehydration from persistence. Order mirrors the ORM entity — keep them in sync. */
  static reconstitute(params: {
    id: AccountId;
    name: string;
    document: Document;
    plan: AccountPlan;
    status: AccountStatus;
    dailySendCeiling: number;
    timezone: string;
    evolutionServerUrl: string | null;
    evolutionApiKey: string | null;
    suspendedAt: Date | null;
    suspensionReason: string | null;
    createdAt: Date;
  }): Account {
    return new Account(
      params.id,
      params.name,
      params.document,
      params.plan,
      params.status,
      params.dailySendCeiling,
      params.timezone,
      params.evolutionServerUrl,
      params.evolutionApiKey,
      params.suspendedAt,
      params.suspensionReason,
      params.createdAt,
    );
  }

  get id(): AccountId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get document(): Document {
    return this._document;
  }

  get plan(): AccountPlan {
    return this._plan;
  }

  get status(): AccountStatus {
    return this._status;
  }

  get dailySendCeiling(): number {
    return this._dailySendCeiling;
  }

  get timezone(): string {
    return this._timezone;
  }

  /** Null → the tenant runs on the platform's shared Evolution server (§14, decisão 7). */
  get evolutionServerUrl(): string | null {
    return this._evolutionServerUrl;
  }

  get evolutionApiKey(): string | null {
    return this._evolutionApiKey;
  }

  get suspendedAt(): Date | null {
    return this._suspendedAt;
  }

  get suspensionReason(): string | null {
    return this._suspensionReason;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get isSuspended(): boolean {
    return this._status === AccountStatus.SUSPENDED;
  }

  /** May this account dispatch at all? Checked again at execution time by the worker (§10 FASE 7). */
  get canDispatch(): boolean {
    return canDispatch(this._status);
  }

  /**
   * Hard ceiling check. `alreadySentToday` comes from `channel_daily_counters`
   * (campaign + reply sends). Never truncates: a plan that does not fit is reported.
   */
  assertFitsDailyCeiling(requested: number, alreadySentToday: number): void {
    const remaining = Math.max(0, this._dailySendCeiling - alreadySentToday);
    if (requested > remaining) {
      throw new DailyCeilingExceededException(requested, remaining);
    }
  }

  remainingDailyAllowance(alreadySentToday: number): number {
    return Math.max(0, this._dailySendCeiling - alreadySentToday);
  }

  suspend(reason: string, suspendedBy: string): void {
    if (this._status === AccountStatus.SUSPENDED) {
      return;
    }
    this._status = AccountStatus.SUSPENDED;
    this._suspendedAt = new Date();
    this._suspensionReason = reason;
    // The handler that moves RUNNING distributions to PAUSED subscribes to this event
    // (the distributions table only exists from FASE 6 on).
    this.addDomainEvent(new AccountSuspendedEvent(this._id.value, reason, suspendedBy));
  }

  reactivate(reactivatedBy: string): void {
    if (this._status !== AccountStatus.SUSPENDED) {
      return;
    }
    this._status = AccountStatus.ACTIVE;
    this._suspendedAt = null;
    this._suspensionReason = null;
    this.addDomainEvent(new AccountReactivatedEvent(this._id.value, reactivatedBy));
  }

  changeDailySendCeiling(ceiling: number): void {
    Account.assertValidCeiling(ceiling);
    this._dailySendCeiling = ceiling;
  }

  /** Moves the tenant to a dedicated Evolution server, or back to the shared one (both null). */
  assignEvolutionServer(url: string | null, apiKey: string | null): void {
    this._evolutionServerUrl = url;
    this._evolutionApiKey = apiKey;
  }

  private static assertValidCeiling(ceiling: number): void {
    if (!Number.isInteger(ceiling) || ceiling <= 0) {
      throw new InvalidSendCeilingException();
    }
  }
}
