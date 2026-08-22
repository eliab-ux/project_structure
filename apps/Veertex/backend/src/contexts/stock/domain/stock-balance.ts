/**
 * O SALDO e o CUSTO MÉDIO derivados dos movimentos (§3.1 e §3.4 do 03) — puro, testável sem banco.
 *
 * ## Derivado, não materializado (§3.1)
 *
 * Não existe tabela de saldo. O saldo é `SUM()` dos movimentos, dobrado aqui num fold. É sempre
 * correto por construção — impossível divergir de uma segunda cópia que não existe. Quando o volume
 * pedir, materializa-se; o sinal é a listagem demorando, não a adivinhação de hoje.
 *
 * ## Média ponderada móvel (§3.4)
 *
 * A cada ENTRADA, o custo médio é recomputado: `(qtd*média + entrada*custoEntrada) / (qtd+entrada)`.
 * SAÍDA não mexe na média, só na quantidade. A ENTRADA COM CUSTO ZERO (bonificação) entra no cálculo
 * e puxa a média para baixo — é mercadoria recebida (decisão registrada no §3.4).
 *
 * O custo de cada movimento já vem RESOLVIDO no `unitCost` (a venda estampou o custo médio da época;
 * a devolução de cliente reentrou pelo custo da época do movimento original, com fallback). Este fold
 * não decide custo — ele aplica o que foi gravado. A resolução mora no `RegisterMovement`.
 */

export interface MovementForBalance {
  /** `in` soma, `out` subtrai, `adjust` usa o sinal de `signedQuantity`. */
  direction: 'in' | 'out' | 'adjust';
  /** Magnitude para in/out (>0); com sinal para adjust (sobra + / falta −). */
  signedQuantity: number;
  /** Custo unitário para ENTRADAS; ignorado nas saídas. */
  unitCost: number | null;
}

export interface StockBalance {
  quantity: number;
  averageCost: number;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Aplica os movimentos EM ORDEM CRONOLÓGICA. A ordem é responsabilidade de quem chama (o repo). */
export function computeBalance(movements: readonly MovementForBalance[]): StockBalance {
  let quantity = 0;
  let averageCost = 0;

  for (const movement of movements) {
    const delta =
      movement.direction === 'out'
        ? -Math.abs(movement.signedQuantity)
        : movement.direction === 'in'
          ? Math.abs(movement.signedQuantity)
          : movement.signedQuantity; // adjust: já vem com sinal

    if (delta > 0) {
      // Entrada sem custo cai no custo médio atual (defensivo — o registro sempre resolve um custo).
      const inCost = movement.unitCost ?? averageCost;
      const newQuantity = quantity + delta;
      averageCost =
        newQuantity > 0 ? (quantity * averageCost + delta * inCost) / newQuantity : inCost;
      quantity = newQuantity;
    } else {
      // Saída (ou ajuste negativo): a média não muda; só a quantidade cai.
      quantity += delta;
    }
  }

  return { quantity: round(quantity, 3), averageCost: round(averageCost, 4) };
}
