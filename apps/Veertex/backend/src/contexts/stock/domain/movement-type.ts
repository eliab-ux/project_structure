/**
 * Os tipos de movimento de estoque (§3.6 do 03, decidido por Eliab 22/08/2026).
 *
 * `transfer` (transferência entre empresas) está FORA: o §2.4 do 03 diz que é operação fiscal, e
 * depende do FIS, que não existe. Entra com o FIS, não antes.
 *
 * `direction` decide o sinal do efeito no saldo. `carriesInputCost` marca as ENTRADAS cujo custo vem
 * no próprio movimento (compra); as demais têm o custo RESOLVIDO na hora do registro (venda estampa o
 * custo médio da época; devolução de cliente reentra pelo custo da época do movimento original).
 */
export const STOCK_MOVEMENT_TYPES = [
  'purchase_in',
  'sale_out',
  'inventory_adjust',
  'customer_return',
  'supplier_return',
  'loss',
  // Transferência interna entre localizações da MESMA empresa (§2 do 03A) — implementada.
  'transfer_out',
  'transfer_in',
  // ⚠️ RESERVADOS para o ROT (§3.1 do 03A): no enum para o tipo não mudar depois, NÃO implementados.
  // Criá-los pelo registro é recusado (ver REGISTERABLE_MOVEMENT_TYPES).
  'trip_load',
  'trip_return',
  'exchange_in',
  'exchange_out',
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export type MovementDirection = 'in' | 'out' | 'adjust';

export interface MovementTypeDefinition {
  label: string;
  direction: MovementDirection;
  /** Entrada cujo custo unitário vem no INPUT (compra, bonificação). */
  carriesInputCost: boolean;
}

export const STOCK_MOVEMENT_TYPE: Record<StockMovementType, MovementTypeDefinition> = {
  purchase_in: { label: 'Entrada por compra', direction: 'in', carriesInputCost: true },
  sale_out: { label: 'Saída por venda', direction: 'out', carriesInputCost: false },
  // Ajuste de inventário: unitário (§3.7), sinal escolhido no registro (sobra ou falta).
  inventory_adjust: { label: 'Ajuste de inventário', direction: 'adjust', carriesInputCost: true },
  // Devolução de cliente: ENTRADA que reentra pelo custo da época (§3.4), resolvido no registro.
  customer_return: { label: 'Devolução de cliente', direction: 'in', carriesInputCost: false },
  supplier_return: { label: 'Devolução a fornecedor', direction: 'out', carriesInputCost: false },
  loss: { label: 'Perda', direction: 'out', carriesInputCost: false },
  transfer_out: { label: 'Transferência (saída)', direction: 'out', carriesInputCost: false },
  transfer_in: { label: 'Transferência (entrada)', direction: 'in', carriesInputCost: true },
  trip_load: { label: 'Carga de viagem', direction: 'out', carriesInputCost: false },
  trip_return: { label: 'Retorno de viagem', direction: 'in', carriesInputCost: false },
  exchange_in: { label: 'Troca (entrada)', direction: 'in', carriesInputCost: false },
  exchange_out: { label: 'Troca (saída)', direction: 'out', carriesInputCost: false },
};

/**
 * Os tipos que o registro MANUAL aceita. Transferência entra pelo `TransferStock` (par atômico), não
 * pelo registro solto; os tipos da rota são reservados (chegam com o ROT). Aceitar um reservado no
 * registro seria a casca que grava um movimento cujo comportamento não existe.
 */
export const REGISTERABLE_MOVEMENT_TYPES: readonly StockMovementType[] = [
  'purchase_in',
  'sale_out',
  'inventory_adjust',
  'customer_return',
  'supplier_return',
  'loss',
];

export function isStockMovementType(value: string): value is StockMovementType {
  return (STOCK_MOVEMENT_TYPES as readonly string[]).includes(value);
}
