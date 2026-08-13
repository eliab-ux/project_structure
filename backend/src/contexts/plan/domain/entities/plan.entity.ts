import { AggregateRoot, DomainException } from '@veertex/domain-primitives';
import { PlanLimits } from '../value-objects/plan-limits.vo';

export class InvalidPlanException extends DomainException {}

/**
 * A commercial plan. GLOBAL, not tenant-scoped: plans are the platform's catalogue, the same rows
 * for every account, which is why this table carries no `account_id` and is readable (never
 * writable) by the runtime role.
 *
 * `code` is the stable identifier used by seeds and by the CLI; the display `name` may change
 * freely without breaking anything that references the plan.
 */
export class Plan extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _code: string,
    private _name: string,
    private _limits: PlanLimits,
    private _active: boolean,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static reconstitute(params: {
    id: string;
    code: string;
    name: string;
    limits: PlanLimits;
    active: boolean;
    createdAt: Date;
  }): Plan {
    return new Plan(
      params.id,
      params.code,
      params.name,
      params.limits,
      params.active,
      params.createdAt,
    );
  }

  static create(params: { id: string; code: string; name: string; limits: PlanLimits }): Plan {
    const code = params.code.trim().toUpperCase();
    if (!/^[A-Z0-9_]{2,30}$/.test(code)) {
      throw new InvalidPlanException('Código do plano deve ter 2–30 caracteres A–Z, 0–9 ou _.');
    }
    return new Plan(params.id, code, params.name.trim(), params.limits, true, new Date());
  }

  get id(): string {
    return this._id;
  }

  get code(): string {
    return this._code;
  }

  get name(): string {
    return this._name;
  }

  get limits(): PlanLimits {
    return this._limits;
  }

  get active(): boolean {
    return this._active;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  rename(name: string): void {
    this._name = name.trim();
  }

  changeLimits(limits: PlanLimits): void {
    this._limits = limits;
  }

  /**
   * Retiring a plan stops NEW accounts from choosing it. Accounts already on it keep it — a
   * commercial decision must never silently downgrade a customer who is paying.
   */
  deactivate(): void {
    this._active = false;
  }

  activate(): void {
    this._active = true;
  }
}
