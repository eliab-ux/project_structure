/**
 * As situações do pedido (§3.2 do 02 + §3.3 do 02A):
 * `rascunho → [orcamento] → confirmado → faturado → concluido`, mais `cancelado`.
 *
 * ## `orcamento` — estágio de primeira classe (§3.3 do 02A)
 *
 * Proposta EMITIDA ao cliente, distinta do `rascunho` (edição inacabada). A vitrine futura gera
 * pré-pedido/orçamento que o representante autoriza; a conversão orçamento→pedido é de primeira
 * classe. É um estado LIVE no V1 (não depende de módulo nenhum): do `rascunho` se emite o orçamento,
 * dele se confirma (converte em pedido) ou se cancela. A validade opcional (`valid_until`) vive no
 * pedido; expiração de orçamento é follow-up (não bloqueia a conversão manual).
 *
 * ## `faturado` existe no enum, mas a transição é BLOQUEADA no V1
 *
 * Faturar dispara baixa de estoque (EST), título a receber (FIN) e emissão de NF-e (FIS) — nenhum
 * dos três existe. O estado entra aqui para o schema já nascer completo, mas a transição para ele é
 * recusada com mensagem enquanto os módulos não existirem — o mesmo "enum pronto, transição guarda
 * loud" da numeração sequencial. O V1 opera `rascunho → [orcamento] → confirmado → concluido` +
 * `cancelado`.
 *
 * Cancelamento (§3.8): antes da NF-e é operação de VND (uma transição daqui). Depois da NF-e seria
 * operação fiscal (FIS) — como não há `faturado` alcançável no V1, esse caminho ainda não aparece.
 */
export const ORDER_STATUSES = [
  'rascunho',
  'orcamento',
  'confirmado',
  'faturado',
  'concluido',
  'cancelado',
  // ── Ciclo PRÓPRIO da consignação (§3.1 do 04) — só para pedidos com origin='rota' ────────────
  // O campo LANÇA (rascunho = proposta); a retaguarda EFETIVA (→ consignado_aberto). A venda só se
  // conclui no acerto: em_acerto durante a passagem seguinte, fechado quando o acerto é efetivado.
  'consignado_aberto',
  'em_acerto',
  'fechado',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  rascunho: 'Rascunho',
  orcamento: 'Orçamento',
  confirmado: 'Confirmado',
  faturado: 'Faturado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  consignado_aberto: 'Consignado aberto',
  em_acerto: 'Em acerto',
  fechado: 'Fechado (acertado)',
};

/** Transições permitidas. `faturado` é alvo válido no mapa, mas o use case o bloqueia no V1. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  // O rascunho de um pedido de ROTA vai para consignado_aberto (efetivação da retaguarda, §3.3 do
  // 04); a entidade guarda que só origin='rota' entra nesse ramo.
  rascunho: ['orcamento', 'confirmado', 'consignado_aberto', 'cancelado'],
  // Orçamento é proposta emitida: converte em pedido (confirmado) ou é cancelado. Não volta a
  // rascunho — reabrir para edição é outra operação (revisar o orçamento gera um novo).
  orcamento: ['confirmado', 'cancelado'],
  confirmado: ['faturado', 'concluido', 'cancelado'],
  faturado: ['concluido', 'cancelado'],
  concluido: [],
  cancelado: [],
  consignado_aberto: ['em_acerto', 'cancelado'],
  em_acerto: ['fechado', 'cancelado'],
  fechado: [],
};

/** Estados cuja transição de ENTRADA exige módulos que não existem no V1 (EST/FIN/FIS). */
export const STATUSES_REQUIRING_MODULES: readonly OrderStatus[] = ['faturado'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
