/**
 * Motor do **Modelo A** de comissão (§2 do 02A) — escala de META, para vendedores de loja/balcão.
 *
 * Régua: `vendido ÷ meta do período` → faixas escalonadas **abertas acima de 100%** (ex.: 100%→1%,
 * 150%→1,5%, 200%→2%). As faixas são customizáveis por conta (pares "faixa % da meta → % de
 * comissão"). Abaixo da menor faixa cadastrada → comissão zero (salvo faixa configurada abaixo de
 * 100%). A comissão incide sobre o VENDIDO, na % da faixa atingida.
 *
 * Função **pura** — sem I/O, sem framework. É o coração testável ao centavo; quem carrega meta,
 * vendido e faixas é o use case.
 */

/** Arredonda a 2 casas (reais) de forma estável. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Par "faixa % da meta atingida → % de comissão". */
export interface CommissionTier {
  thresholdPercent: number;
  commissionPercent: number;
}

export interface ModelAResult {
  meta: number;
  vendido: number;
  /** `vendido / meta * 100`, 2 casas. 0 quando não há meta (> 0). */
  ratioPercent: number;
  /** A faixa atingida (maior threshold ≤ ratio), ou `null` se abaixo da menor faixa. */
  appliedThresholdPercent: number | null;
  /** % de comissão da faixa atingida (0 se nenhuma). */
  commissionPercent: number;
  /** `vendido * commissionPercent / 100`, ao centavo. */
  commissionValue: number;
}

/**
 * Comissão do Modelo A. Sem meta (> 0) → comissão zero (o Modelo A não se apura sem meta). A faixa
 * atingida é a de MAIOR `thresholdPercent` que ainda cabe no `ratioPercent` — as faixas acima de
 * 100% são abertas, então 300% cai na maior faixa cadastrada.
 */
export function computeModelACommission(params: {
  vendido: number;
  meta: number;
  tiers: readonly CommissionTier[];
}): ModelAResult {
  const vendido = Math.max(0, params.vendido);
  const meta = params.meta;

  if (!(meta > 0)) {
    return {
      meta,
      vendido,
      ratioPercent: 0,
      appliedThresholdPercent: null,
      commissionPercent: 0,
      commissionValue: 0,
    };
  }

  const ratioPercent = round2((vendido / meta) * 100);

  // Maior faixa cujo threshold cabe no ratio. Ordena desc e pega a primeira aplicável.
  const applied = [...params.tiers]
    .sort((a, b) => b.thresholdPercent - a.thresholdPercent)
    .find((tier) => ratioPercent >= tier.thresholdPercent);

  const commissionPercent = applied?.commissionPercent ?? 0;
  const commissionValue = round2((vendido * commissionPercent) / 100);

  return {
    meta,
    vendido,
    ratioPercent,
    appliedThresholdPercent: applied?.thresholdPercent ?? null,
    commissionPercent,
    commissionValue,
  };
}
