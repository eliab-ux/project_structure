/**
 * As situações do pedido (§3.2 do 02, decidido por Eliab 22/08/2026):
 * `rascunho → confirmado → faturado → concluido`, mais `cancelado`.
 *
 * ## `faturado` existe no enum, mas a transição é BLOQUEADA no V1
 *
 * Faturar dispara baixa de estoque (EST), título a receber (FIN) e emissão de NF-e (FIS) — nenhum
 * dos três existe. O estado entra aqui para o schema já nascer completo, mas a transição para ele é
 * recusada com mensagem enquanto os módulos não existirem — o mesmo "enum pronto, transição guarda
 * loud" da numeração sequencial. O V1 opera `rascunho → confirmado → concluido` + `cancelado`.
 *
 * Cancelamento (§3.8): antes da NF-e é operação de VND (uma transição daqui). Depois da NF-e seria
 * operação fiscal (FIS) — como não há `faturado` alcançável no V1, esse caminho ainda não aparece.
 */
export const ORDER_STATUSES = [
  'rascunho',
  'confirmado',
  'faturado',
  'concluido',
  'cancelado',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  faturado: 'Faturado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

/** Transições permitidas. `faturado` é alvo válido no mapa, mas o use case o bloqueia no V1. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  rascunho: ['confirmado', 'cancelado'],
  confirmado: ['faturado', 'concluido', 'cancelado'],
  faturado: ['concluido', 'cancelado'],
  concluido: [],
  cancelado: [],
};

/** Estados cuja transição de ENTRADA exige módulos que não existem no V1 (EST/FIN/FIS). */
export const STATUSES_REQUIRING_MODULES: readonly OrderStatus[] = ['faturado'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
