import { DomainException, ValueObject } from '@gitspread/domain-primitives';

export class InvalidPlanLimitsException extends DomainException {}

/** `null` means "no ceiling" — an explicit value, not a missing one. */
export interface PlanLimitsProps {
  maxCompanies: number | null;
  maxUsers: number | null;
  /**
   * Module codes the plan allows (`CORE`, `VND`, `EST`, …). The plan is the CEILING; what the
   * account actually has switched on lives in `account_module` (F2). The final visibility is
   * `plano ∩ conta ∩ papel` (Visão Geral §2.1) and this is the first of the three.
   */
  modules: readonly string[];
}

/**
 * The commercial ceiling of a plan, persisted as jsonb.
 *
 * jsonb and not columns because this is the one place where a shapeless value is the right answer:
 * every new module or metered resource would otherwise be an ALTER TABLE on a table with one row
 * per plan. It is NOT the `field_config` situation — nothing here is a business entity's attribute,
 * and the schema is owned by this value object, which validates it.
 */
export class PlanLimits extends ValueObject<PlanLimitsProps> {
  private constructor(props: PlanLimitsProps) {
    super(props);
  }

  static create(input: {
    maxCompanies?: number | null;
    maxUsers?: number | null;
    modules?: readonly string[];
  }): PlanLimits {
    const maxCompanies = PlanLimits.normalizeCeiling(input.maxCompanies, 'maxCompanies');
    const maxUsers = PlanLimits.normalizeCeiling(input.maxUsers, 'maxUsers');
    const modules = Array.from(new Set(input.modules ?? [])).sort();

    // CORE is not optional (01_Veertex_Core §preâmbulo: "sempre ativo, não desativável"), so a plan
    // that omits it would describe a product that cannot log in. Added rather than rejected: the
    // seed should not have to restate a constant of the system.
    if (!modules.includes('CORE')) {
      modules.unshift('CORE');
    }

    return new PlanLimits({ maxCompanies, maxUsers, modules: Object.freeze(modules) });
  }

  private static normalizeCeiling(value: number | null | undefined, field: string): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Number.isInteger(value) || value < 1) {
      throw new InvalidPlanLimitsException(
        `${field} deve ser um inteiro ≥ 1 ou nulo (sem limite).`,
      );
    }
    return value;
  }

  get maxCompanies(): number | null {
    return this.props.maxCompanies;
  }

  get maxUsers(): number | null {
    return this.props.maxUsers;
  }

  get modules(): readonly string[] {
    return this.props.modules;
  }

  allowsModule(code: string): boolean {
    return this.props.modules.includes(code);
  }

  /** `true` when adding one more would exceed the ceiling. `null` ceiling never blocks. */
  wouldExceedCompanies(current: number): boolean {
    return this.props.maxCompanies !== null && current + 1 > this.props.maxCompanies;
  }

  wouldExceedUsers(current: number): boolean {
    return this.props.maxUsers !== null && current + 1 > this.props.maxUsers;
  }

  toJSON(): PlanLimitsProps {
    return {
      maxCompanies: this.props.maxCompanies,
      maxUsers: this.props.maxUsers,
      modules: [...this.props.modules],
    };
  }
}
