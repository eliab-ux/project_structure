import { AggregateRoot } from '@veertex/domain-primitives';
import { Document } from '../../../../shared/domain/value-objects/document.vo';
import { AccountId } from '../value-objects/account-id.vo';
import { AccountStatus } from '../value-objects/account-status.vo';
import { AccountCreatedEvent } from '../events/account-created.event';
import { AccountUnavailableException } from '../exceptions/account-unavailable.exception';

/**
 * The tenant itself.
 *
 * `accounts` is the ONE business table with no `account_id`: its own `id` is the tenant. It
 * therefore sits outside the global tenant filter, and its RLS policy compares `id` (not
 * `account_id`) with the request scope — so an authenticated user can read their own account row
 * and no other. Every read of an account must come from a use case that either uses the JWT's
 * accountId or runs under the operator scope (CLI, migrations).
 */
export class Account extends AggregateRoot {
  private constructor(
    private readonly _id: AccountId,
    private _name: string,
    private _document: Document,
    private _planId: string,
    private _status: AccountStatus,
    private _timezone: string,
    private _suspendedAt: Date | null,
    private _suspensionReason: string | null,
    private _cancellationRequestedAt: Date | null,
    private _cancelledAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    name: string;
    document: Document;
    planId: string;
    planCode: string;
    timezone?: string;
  }): Account {
    const id = AccountId.generate();
    const account = new Account(
      id,
      params.name.trim(),
      params.document,
      params.planId,
      AccountStatus.ACTIVE,
      params.timezone?.trim() || 'America/Sao_Paulo',
      null,
      null,
      null,
      null,
      new Date(),
    );
    account.addDomainEvent(new AccountCreatedEvent(id.value, params.planCode));
    return account;
  }

  static reconstitute(params: {
    id: AccountId;
    name: string;
    document: Document;
    planId: string;
    status: AccountStatus;
    timezone: string;
    suspendedAt: Date | null;
    suspensionReason: string | null;
    cancellationRequestedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
  }): Account {
    return new Account(
      params.id,
      params.name,
      params.document,
      params.planId,
      params.status,
      params.timezone,
      params.suspendedAt,
      params.suspensionReason,
      params.cancellationRequestedAt,
      params.cancelledAt,
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

  get planId(): string {
    return this._planId;
  }

  get status(): AccountStatus {
    return this._status;
  }

  get timezone(): string {
    return this._timezone;
  }

  get suspendedAt(): Date | null {
    return this._suspendedAt;
  }

  get suspensionReason(): string | null {
    return this._suspensionReason;
  }

  get cancellationRequestedAt(): Date | null {
    return this._cancellationRequestedAt;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get isActive(): boolean {
    return this._status === AccountStatus.ACTIVE;
  }

  /** Called on every authentication: a suspended tenant must not be able to log in. */
  assertUsable(): void {
    if (!this.isActive) {
      throw new AccountUnavailableException();
    }
  }

  rename(name: string): void {
    this._name = name.trim();
  }

  changeTimezone(timezone: string): void {
    this._timezone = timezone.trim();
  }

  changePlan(planId: string): void {
    this._planId = planId;
  }

  suspend(reason: string): void {
    this._status = AccountStatus.SUSPENDED;
    this._suspendedAt = new Date();
    this._suspensionReason = reason.trim().slice(0, 500);
  }

  reactivate(): void {
    this._status = AccountStatus.ACTIVE;
    this._suspendedAt = null;
    this._suspensionReason = null;
  }

  /**
   * Step one of cancellation: the clock starts, the account keeps working, and the customer can
   * export everything. Nothing is deleted here — that is the entire point of the two steps
   * (Visão Geral §2.5, padrão Bling).
   */
  requestCancellation(): void {
    this._cancellationRequestedAt ??= new Date();
  }

  withdrawCancellation(): void {
    this._cancellationRequestedAt = null;
  }

  /** Step two, deliberately a separate operator action rather than a timer in the domain. */
  confirmCancellation(): void {
    this._status = AccountStatus.CANCELLED;
    this._cancelledAt = new Date();
  }
}
