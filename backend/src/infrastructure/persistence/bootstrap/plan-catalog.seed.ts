import { PlanLimitsProps } from '../../../contexts/plan/domain/value-objects/plan-limits.vo';
import { SqlExecutor } from '../isolation-invariants';

export interface PlanCatalogEntry {
  /** Fixed UUID: the same plan keeps the same id in every environment, so an account exported from
   * one and imported into another still points at a plan that exists. */
  id: string;
  code: string;
  name: string;
  limits: PlanLimitsProps;
}

/**
 * THE plan catalogue — the single definition, applied idempotently at every boot.
 *
 * It lives here and not in a migration because a plan is DATA, not schema: ceilings and module
 * bundles change for commercial reasons, several times, and each change would otherwise be a
 * migration file. Reconciling on boot also means a fresh database and a three-year-old one end up
 * with the same catalogue.
 *
 * ⚠️ **PENDÊNCIA COMERCIAL** (Visão Geral §9.2 — nada de silent default). The three tiers below
 * exist so `create:account` has something to reference. The ceilings and the module grouping are an
 * engineering guess, NOT a product decision. Review with Eliab before any sale.
 */
export const PLAN_CATALOG: readonly PlanCatalogEntry[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'ESSENCIAL',
    name: 'Essencial',
    limits: { modules: ['CORE', 'VND', 'EST', 'FIN'] },
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    code: 'COMPLETO',
    name: 'Completo',
    limits: {
      modules: ['CORE', 'VND', 'EST', 'FIN', 'ROT', 'COB', 'FIS'],
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    code: 'DIGITAL',
    name: 'Digital',
    limits: {
      modules: ['CORE', 'VND', 'EST', 'FIN', 'ROT', 'COB', 'FIS', 'CAN', 'EXP'],
    },
  },
];

export interface PlanSeedResult {
  inserted: number;
  unchanged: number;
}

/**
 * Inserts missing plans. **Never updates an existing row, and never deactivates one.**
 *
 * That restraint is the whole design. A seed that overwrote on every boot would silently revert any
 * ceiling adjusted by hand for a customer — and the revert would land at the next deploy, far from
 * whoever made the change. And a seed that deactivated plans absent from this list would downgrade
 * paying accounts the moment someone renamed a tier.
 *
 * So: this file bootstraps a catalogue, it does not own one. Changing a live plan is an UPDATE
 * (later, an admin screen); adding a tier is an entry here.
 *
 * Runs on the OWNER connection — the runtime role has only SELECT on `plans`, by design.
 */
export async function seedPlanCatalog(query: SqlExecutor): Promise<PlanSeedResult> {
  let inserted = 0;

  for (const plan of PLAN_CATALOG) {
    const rows = await query(
      `insert into plans (id, code, name, limits, active, created_at)
            values ($1, $2, $3, $4::jsonb, true, now())
       on conflict (code) do nothing
         returning code`,
      [plan.id, plan.code, plan.name, JSON.stringify(plan.limits)],
    );
    if (rows.length > 0) {
      inserted += 1;
    }
  }

  return { inserted, unchanged: PLAN_CATALOG.length - inserted };
}
