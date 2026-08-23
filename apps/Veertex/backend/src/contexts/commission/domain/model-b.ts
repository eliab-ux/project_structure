import { CommissionTier, round2 } from './model-a';

/**
 * Motor do **Modelo B** de comissão (§2.2 do 02A / §3.6 do 04) — escala de RECEBIMENTO, para
 * representantes de ROTA. Régua: `recebido ÷ carteira (cobrança + recobrança)` → faixa → **% de
 * comissão DIRETO** sobre o **recebido LÍQUIDO** da comissão do revendedor.
 *
 * Faixas reais da operação (customizáveis por conta): ≥90%→8% · 70–89,99%→7% · 50–69,99%→6%.
 * Abaixo da menor faixa → zero. **Meta de venda NÃO participa** do Modelo B.
 *
 * Diferente do Modelo A: aqui a % é DIRETA (não escalonada sobre a meta), a razão é de recebimento,
 * e a base da comissão é o recebido líquido — que pode diferir do recebido usado na razão (o líquido
 * já desconta a comissão do revendedor). Por isso `base` é entrada própria.
 *
 * Função **pura** — o coração testável ao centavo contra as planilhas reais. Gatilho: fechamento da
 * viagem (04 §3.6); a empresa do título vem da viagem (não é parâmetro, ao contrário do Modelo A).
 */
export interface ModelBResult {
  recebido: number;
  carteira: number;
  base: number;
  ratioPercent: number;
  appliedThresholdPercent: number | null;
  commissionPercent: number;
  commissionValue: number;
}

export function computeModelBCommission(params: {
  /** Recebido do período (numerador da razão). */
  recebido: number;
  /** Carteira da viagem = cobrança + recobrança (denominador da razão). */
  carteira: number;
  /** Base da comissão: recebido LÍQUIDO da comissão do revendedor. Ausente → usa `recebido`. */
  base?: number;
  tiers: readonly CommissionTier[];
}): ModelBResult {
  const recebido = Math.max(0, params.recebido);
  const carteira = params.carteira;
  const base = Math.max(0, params.base ?? recebido);

  const ratioPercent = carteira > 0 ? round2((recebido / carteira) * 100) : 0;

  const applied = [...params.tiers]
    .sort((a, b) => b.thresholdPercent - a.thresholdPercent)
    .find((tier) => ratioPercent >= tier.thresholdPercent);

  const commissionPercent = applied?.commissionPercent ?? 0;
  const commissionValue = round2((base * commissionPercent) / 100);

  return {
    recebido,
    carteira,
    base,
    ratioPercent,
    appliedThresholdPercent: applied?.thresholdPercent ?? null,
    commissionPercent,
    commissionValue,
  };
}
