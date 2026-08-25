import { AggregateRoot } from '@gitspread/domain-primitives';
import { ChannelId } from '../value-objects/channel-id.vo';
import { ChannelStatus, canSend, isTerminal } from '../value-objects/channel-status.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { QuotaBand } from '../value-objects/quota-band.vo';
import { ThrottleDecision } from '../value-objects/throttle-decision.vo';
import {
  ChannelInTerminalStateException,
  InvalidChannelTransitionException,
} from '../exceptions/invalid-channel-transition.exception';
import { ChannelConnectedEvent } from '../events/channel-connected.event';
import { ChannelDisconnectedEvent } from '../events/channel-disconnected.event';
import { ChannelDegradedEvent } from '../events/channel-degraded.event';
import { ChannelQuotaAdjustedEvent } from '../events/channel-quota-adjusted.event';
import { ChannelRetiredEvent } from '../events/channel-retired.event';
import { ChannelBannedEvent } from '../events/channel-banned.event';

/**
 * Transitions the system allows. Everything absent from this map is refused — including every
 * path INTO a terminal state, which is why `BANNED` and `RETIRED` are not listed as targets here:
 * they are reachable only through `declareBanned()` / `retire()`, which take a human actor.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<ChannelStatus, readonly ChannelStatus[]>> = {
  [ChannelStatus.PROVISIONING]: [ChannelStatus.AWAITING_QR, ChannelStatus.DISCONNECTED],
  [ChannelStatus.AWAITING_QR]: [ChannelStatus.CONNECTED, ChannelStatus.DISCONNECTED],
  [ChannelStatus.CONNECTED]: [ChannelStatus.DISCONNECTED, ChannelStatus.DEGRADED],
  [ChannelStatus.DISCONNECTED]: [
    ChannelStatus.AWAITING_QR,
    ChannelStatus.CONNECTED,
    ChannelStatus.DEGRADED,
  ],
  // DEGRADED does not walk back on its own: the system paused this channel and wants a human to
  // look at it, so recovery is an explicit `reinstate()`.
  [ChannelStatus.DEGRADED]: [ChannelStatus.DISCONNECTED],
  [ChannelStatus.BANNED]: [],
  [ChannelStatus.RETIRED]: [],
};

/**
 * A sender chip.
 *
 * Everything that decides risk lives here: the state machine, the quota band, and the consecutive
 * failure count. Pure domain — no ORM, no HTTP, no Evolution API.
 */
export class Channel extends AggregateRoot {
  private constructor(
    private readonly _id: ChannelId,
    private readonly _accountId: string,
    private _label: string,
    private _phone: PhoneE164,
    private readonly _evolutionInstanceName: string,
    private _status: ChannelStatus,
    private _warmupStartedAt: Date | null,
    private _quota: QuotaBand,
    private _consecutiveFailures: number,
    private _lastSendAt: Date | null,
    private _lastQuotaReviewAt: Date | null,
    private _disconnectEventsToday: number,
    private _lastDisconnectAt: Date | null,
    private _retiredAt: Date | null,
    private _retiredBy: string | null,
    private _terminalReason: string | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    label: string;
    phone: PhoneE164;
    quota: QuotaBand;
  }): Channel {
    const id = ChannelId.generate();
    return new Channel(
      id,
      params.accountId,
      params.label.trim(),
      params.phone,
      Channel.buildInstanceName(params.accountId, id.value),
      ChannelStatus.PROVISIONING,
      null,
      params.quota,
      0,
      null,
      null,
      0,
      null,
      null,
      null,
      null,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: ChannelId;
    accountId: string;
    label: string;
    phone: PhoneE164;
    evolutionInstanceName: string;
    status: ChannelStatus;
    warmupStartedAt: Date | null;
    quota: QuotaBand;
    consecutiveFailures: number;
    lastSendAt: Date | null;
    lastQuotaReviewAt: Date | null;
    disconnectEventsToday: number;
    lastDisconnectAt: Date | null;
    retiredAt: Date | null;
    retiredBy: string | null;
    terminalReason: string | null;
    createdAt: Date;
  }): Channel {
    return new Channel(
      params.id,
      params.accountId,
      params.label,
      params.phone,
      params.evolutionInstanceName,
      params.status,
      params.warmupStartedAt,
      params.quota,
      params.consecutiveFailures,
      params.lastSendAt,
      params.lastQuotaReviewAt,
      params.disconnectEventsToday,
      params.lastDisconnectAt,
      params.retiredAt,
      params.retiredBy,
      params.terminalReason,
      params.createdAt,
    );
  }

  /**
   * `acct-{account_id}-ch-{channel_id}` (§5, FASE 2 item 2). Namespaced because a name without
   * the tenant in it allows two tenants to collide on the shared Evolution server.
   */
  static buildInstanceName(accountId: string, channelId: string): string {
    return `acct-${accountId}-ch-${channelId}`;
  }

  get id(): ChannelId {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get label(): string {
    return this._label;
  }

  get phone(): PhoneE164 {
    return this._phone;
  }

  get evolutionInstanceName(): string {
    return this._evolutionInstanceName;
  }

  get status(): ChannelStatus {
    return this._status;
  }

  get warmupStartedAt(): Date | null {
    return this._warmupStartedAt;
  }

  get quota(): QuotaBand {
    return this._quota;
  }

  get consecutiveFailures(): number {
    return this._consecutiveFailures;
  }

  get lastSendAt(): Date | null {
    return this._lastSendAt;
  }

  get lastQuotaReviewAt(): Date | null {
    return this._lastQuotaReviewAt;
  }

  get disconnectEventsToday(): number {
    return this._disconnectEventsToday;
  }

  get lastDisconnectAt(): Date | null {
    return this._lastDisconnectAt;
  }

  get retiredAt(): Date | null {
    return this._retiredAt;
  }

  get retiredBy(): string | null {
    return this._retiredBy;
  }

  get terminalReason(): string | null {
    return this._terminalReason;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get isTerminal(): boolean {
    return isTerminal(this._status);
  }

  get canSend(): boolean {
    return canSend(this._status);
  }

  get isWarmingUp(): boolean {
    return this._warmupStartedAt !== null && !this._quota.isAtCeiling;
  }

  // ---------------------------------------------------------------- pairing

  /** Instance created on the Evolution server; the QR is now fetchable. */
  markAwaitingQr(): void {
    this.transitionTo(ChannelStatus.AWAITING_QR);
  }

  /**
   * Pairing succeeded (or the connection came back). Warm-up starts on the FIRST connection and
   * is never restarted by a later reconnect — otherwise every dropped connection would reset the
   * ramp and the channel would never mature.
   */
  markConnected(): void {
    if (this._status === ChannelStatus.CONNECTED) {
      return;
    }
    this.transitionTo(ChannelStatus.CONNECTED);
    if (this._warmupStartedAt === null) {
      this._warmupStartedAt = new Date();
      this._quota = this._quota.atFloor();
    }
    // A healthy connection clears the failure streak that the circuit breaker counts.
    this._consecutiveFailures = 0;
    this.addDomainEvent(new ChannelConnectedEvent(this._accountId, this._id.value));
  }

  /**
   * Transient loss. Counted for the day because `disconnect_events` is a throttle signal, and
   * repeated flapping is what an unstable instance looks like from the outside.
   */
  markDisconnected(reason: string | null = null): void {
    if (this._status === ChannelStatus.DISCONNECTED) {
      this._disconnectEventsToday += 1;
      this._lastDisconnectAt = new Date();
      return;
    }
    this.transitionTo(ChannelStatus.DISCONNECTED);
    this._disconnectEventsToday += 1;
    this._lastDisconnectAt = new Date();
    this.addDomainEvent(new ChannelDisconnectedEvent(this._accountId, this._id.value, reason));
  }

  /** Called by the daily review after the counters are snapshotted. */
  resetDisconnectEventsForNewDay(): void {
    this._disconnectEventsToday = 0;
  }

  // ---------------------------------------------------------------- risk controls

  /**
   * Circuit breaker (§10, FASE 7 item 7). N consecutive failures degrade the channel and pause
   * its queue. It explicitly does NOT declare BANNED: that is a human call.
   *
   * @returns true when this failure tripped the breaker.
   */
  registerSendFailure(threshold: number): boolean {
    this._consecutiveFailures += 1;
    if (this._consecutiveFailures >= threshold && !this.isTerminal) {
      this.degrade(`Falhas consecutivas: ${this._consecutiveFailures}`);
      return true;
    }
    return false;
  }

  registerSendSuccess(sentAt: Date = new Date()): void {
    this._consecutiveFailures = 0;
    this._lastSendAt = sentAt;
  }

  /**
   * Pauses the channel and asks for a human. Reachable from the throttle PAUSE decision and from
   * the circuit breaker — both automatic, and both stop here, one step short of terminal.
   */
  degrade(reason: string): void {
    if (this._status === ChannelStatus.DEGRADED) {
      return;
    }
    this.transitionTo(ChannelStatus.DEGRADED);
    // Degrading also drops the quota to the floor: whatever the channel had earned is no longer
    // trustworthy, and it re-earns the ramp after a human reinstates it.
    this._quota = this._quota.atFloor();
    this.addDomainEvent(new ChannelDegradedEvent(this._accountId, this._id.value, reason));
  }

  /**
   * Human lifts a DEGRADED channel. It comes back as DISCONNECTED, not CONNECTED: the real state
   * is whatever the Evolution instance reports next, and claiming CONNECTED here would be a guess.
   */
  reinstate(): void {
    if (this._status !== ChannelStatus.DEGRADED) {
      throw new InvalidChannelTransitionException(this._status, ChannelStatus.DISCONNECTED);
    }
    this.transitionTo(ChannelStatus.DISCONNECTED);
    this._consecutiveFailures = 0;
  }

  // ---------------------------------------------------------------- terminal states (human only)

  /**
   * Human declares the number banned by WhatsApp. Terminal, and the ONLY thing that — together
   * with retire() — enables migrating this channel's contacts (§6.4).
   */
  declareBanned(declaredBy: string, reason: string): void {
    this.assertNotTerminal();
    this._status = ChannelStatus.BANNED;
    this._retiredAt = new Date();
    this._retiredBy = declaredBy;
    this._terminalReason = reason;
    this._quota = this._quota.atFloor();
    this.addDomainEvent(
      new ChannelBannedEvent(this._accountId, this._id.value, declaredBy, reason),
    );
  }

  /** Human retires the chip on purpose (§5, FASE 2 item 5). Terminal. */
  retire(retiredBy: string, reason: string): void {
    this.assertNotTerminal();
    this._status = ChannelStatus.RETIRED;
    this._retiredAt = new Date();
    this._retiredBy = retiredBy;
    this._terminalReason = reason;
    this._quota = this._quota.atFloor();
    this.addDomainEvent(
      new ChannelRetiredEvent(this._accountId, this._id.value, retiredBy, reason),
    );
  }

  // ---------------------------------------------------------------- quota

  /** Operator-owned half of the band. Never touches `current` except to re-clamp it. */
  changeQuotaBand(floor: number, ceiling: number): void {
    this.assertNotTerminal();
    this._quota = this._quota.withBand(floor, ceiling);
  }

  /**
   * Job-owned half. Applies one throttle decision and records that the review happened, so a
   * re-run on the same day is visible rather than silent.
   */
  applyThrottleDecision(
    decision: ThrottleDecision,
    reason: string,
    factors: { raise: number; lower: number },
    reviewedAt: Date = new Date(),
  ): void {
    this.assertNotTerminal();
    const previous = this._quota.current;

    switch (decision) {
      case ThrottleDecision.RAISE:
        this._quota = this._quota.raisedBy(factors.raise);
        break;
      case ThrottleDecision.LOWER:
        this._quota = this._quota.loweredBy(factors.lower);
        break;
      case ThrottleDecision.PAUSE:
        // degrade() already drops to the floor and emits its own event.
        this.degrade(reason);
        break;
      case ThrottleDecision.HOLD:
      default:
        break;
    }

    this._lastQuotaReviewAt = reviewedAt;

    if (this._quota.current !== previous) {
      this.addDomainEvent(
        new ChannelQuotaAdjustedEvent(
          this._accountId,
          this._id.value,
          decision,
          previous,
          this._quota.current,
          reason,
        ),
      );
    }
  }

  private assertNotTerminal(): void {
    if (this.isTerminal) {
      throw new ChannelInTerminalStateException(this._status);
    }
  }

  private transitionTo(next: ChannelStatus): void {
    if (this._status === next) {
      return;
    }
    this.assertNotTerminal();
    if (!ALLOWED_TRANSITIONS[this._status].includes(next)) {
      throw new InvalidChannelTransitionException(this._status, next);
    }
    this._status = next;
  }
}
