import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidQuotaBandException } from '../exceptions/invalid-quota-band.exception';

/**
 * The band inside which the throttle may move a channel's daily quota.
 *
 * The split matters (§2.1): the OPERATOR owns `floor` and `ceiling`; the JOB owns `current`.
 * There is no method here that lets a caller set `current` to an arbitrary number — only
 * `raisedBy` / `loweredBy` / `atFloor`, which clamp to the band. That is what makes
 * "current_quota nunca editável direto pela UI" structural instead of a convention.
 */
export class QuotaBand extends ValueObject<{ floor: number; ceiling: number; current: number }> {
  private constructor(props: { floor: number; ceiling: number; current: number }) {
    super(props);
  }

  static create(floor: number, ceiling: number, current?: number): QuotaBand {
    if (!Number.isInteger(floor) || !Number.isInteger(ceiling) || floor < 1 || ceiling < floor) {
      throw new InvalidQuotaBandException();
    }
    // A new channel starts at the floor and warms up from there (§2.1).
    const value = current ?? floor;
    if (!Number.isInteger(value)) {
      throw new InvalidQuotaBandException();
    }
    return new QuotaBand({ floor, ceiling, current: QuotaBand.clamp(value, floor, ceiling) });
  }

  get floor(): number {
    return this.props.floor;
  }

  get ceiling(): number {
    return this.props.ceiling;
  }

  get current(): number {
    return this.props.current;
  }

  get isAtCeiling(): boolean {
    return this.props.current >= this.props.ceiling;
  }

  get isAtFloor(): boolean {
    return this.props.current <= this.props.floor;
  }

  /** Gradual, and never past the ceiling. Rounds DOWN so the ramp is never optimistic. */
  raisedBy(factor: number): QuotaBand {
    const next = Math.floor(this.props.current * factor);
    return QuotaBand.create(
      this.props.floor,
      this.props.ceiling,
      Math.max(next, this.props.current + 1),
    );
  }

  /**
   * Aggressive, and never below the floor. Rounds DOWN and always moves by at least one, so a
   * LOWER decision on a small quota is never a no-op that leaves a bad channel where it was.
   */
  loweredBy(factor: number): QuotaBand {
    const next = Math.floor(this.props.current * factor);
    return QuotaBand.create(
      this.props.floor,
      this.props.ceiling,
      Math.min(next, this.props.current - 1),
    );
  }

  /** Used when a channel is paused/degraded: it drops straight to the floor, not to zero. */
  atFloor(): QuotaBand {
    return QuotaBand.create(this.props.floor, this.props.ceiling, this.props.floor);
  }

  /**
   * Operator changes the band. `current` is re-clamped into the new band rather than reset:
   * lowering the ceiling below the current value must take effect immediately, but raising the
   * ceiling must NOT hand the channel a jump it did not earn.
   */
  withBand(floor: number, ceiling: number): QuotaBand {
    return QuotaBand.create(floor, ceiling, this.props.current);
  }

  private static clamp(value: number, floor: number, ceiling: number): number {
    return Math.min(Math.max(value, floor), ceiling);
  }
}
