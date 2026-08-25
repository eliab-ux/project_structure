import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { DistributionStatus, isTerminal } from '../value-objects/distribution-status.vo';
import { DistributionWindow } from '../value-objects/distribution-window.vo';
import { TargetFilter } from '../value-objects/target-filter.vo';
import { InvalidDistributionTransitionException } from '../exceptions/invalid-distribution-transition.exception';
import { DistributionConfirmedEvent } from '../events/distribution-confirmed.event';
import { DistributionCancelledEvent } from '../events/distribution-cancelled.event';

/**
 * A planned send of one content to an audience, inside a time window.
 *
 * The state machine is small and every edge is here rather than in a use case, because the expensive
 * mistakes are transitions: resuming something that was cancelled, confirming twice (which would
 * enqueue every job a second time), or cancelling something already finished.
 */
export class Distribution extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _contentId: string,
    private _window: DistributionWindow,
    private _status: DistributionStatus,
    private readonly _targetFilter: TargetFilter,
    private readonly _config: Record<string, unknown>,
    private readonly _createdBy: string,
    private _confirmedAt: Date | null,
    private _completedAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    contentId: string;
    window: DistributionWindow;
    targetFilter: TargetFilter;
    config: Record<string, unknown>;
    createdBy: string;
  }): Distribution {
    return new Distribution(
      randomUUID(),
      params.accountId,
      params.contentId,
      params.window,
      // Born as DRAFT even though the plan is already persisted: the rows exist, nothing is queued.
      DistributionStatus.DRAFT,
      params.targetFilter,
      params.config,
      params.createdBy,
      null,
      null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    contentId: string;
    window: DistributionWindow;
    status: DistributionStatus;
    targetFilter: TargetFilter;
    config: Record<string, unknown>;
    createdBy: string;
    confirmedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }): Distribution {
    return new Distribution(
      params.id,
      params.accountId,
      params.contentId,
      params.window,
      params.status,
      params.targetFilter,
      params.config,
      params.createdBy,
      params.confirmedAt,
      params.completedAt,
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

  get window(): DistributionWindow {
    return this._window;
  }

  get status(): DistributionStatus {
    return this._status;
  }

  get targetFilter(): TargetFilter {
    return this._targetFilter;
  }

  get config(): Record<string, unknown> {
    return this._config;
  }

  get createdBy(): string {
    return this._createdBy;
  }

  get confirmedAt(): Date | null {
    return this._confirmedAt;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  /** Whether a worker may act on this distribution's dispatches right now. */
  get isDispatchable(): boolean {
    return (
      this._status === DistributionStatus.PLANNED || this._status === DistributionStatus.RUNNING
    );
  }

  /**
   * The operator saw the preview and said yes. The ONLY transition that enqueues work.
   *
   * Refusing a second confirmation is not defensive coding: confirming twice would enqueue every job
   * again, and while the job id makes the worker idempotent per dispatch, nothing would stop the
   * duplicated delays from being scheduled.
   */
  confirm(): void {
    if (this._status !== DistributionStatus.DRAFT) {
      throw new InvalidDistributionTransitionException(this._status, DistributionStatus.PLANNED);
    }
    this._status = DistributionStatus.PLANNED;
    this._confirmedAt = new Date();
    this.addDomainEvent(new DistributionConfirmedEvent(this._accountId, this._id, this._contentId));
  }

  /** First send went out. Cosmetic for the operator, meaningful for "distribuições em andamento". */
  markRunning(): void {
    if (this._status === DistributionStatus.PLANNED) {
      this._status = DistributionStatus.RUNNING;
    }
  }

  pause(): void {
    if (
      this._status !== DistributionStatus.PLANNED &&
      this._status !== DistributionStatus.RUNNING
    ) {
      throw new InvalidDistributionTransitionException(this._status, DistributionStatus.PAUSED);
    }
    this._status = DistributionStatus.PAUSED;
  }

  resume(): void {
    if (this._status !== DistributionStatus.PAUSED) {
      throw new InvalidDistributionTransitionException(this._status, DistributionStatus.RUNNING);
    }
    // Back to RUNNING and not PLANNED: sends already happened, and the panel should not claim
    // otherwise.
    this._status = DistributionStatus.RUNNING;
  }

  /** Cancels what has not gone out. Sent messages are history and stay (§10, FASE 7 item 8). */
  cancel(reason: string | null): void {
    if (isTerminal(this._status)) {
      throw new InvalidDistributionTransitionException(this._status, DistributionStatus.CANCELLED);
    }
    this._status = DistributionStatus.CANCELLED;
    this.addDomainEvent(new DistributionCancelledEvent(this._accountId, this._id, reason));
  }

  /** Every dispatch reached a final state. */
  complete(): void {
    if (isTerminal(this._status)) {
      return;
    }
    this._status = DistributionStatus.COMPLETED;
    this._completedAt = new Date();
  }

  /**
   * Extending the window is allowed while the distribution is still live, and it is the documented
   * answer to a plan that did not fit (§9.2). Shortening it is not: dispatches are already scheduled
   * inside the old window, and moving the end line backwards would silently orphan them.
   */
  extendWindowTo(newEnd: Date): void {
    if (!this.isDispatchable && this._status !== DistributionStatus.DRAFT) {
      throw new InvalidDistributionTransitionException(this._status, this._status);
    }
    this._window = this._window.extendedTo(newEnd);
  }
}
