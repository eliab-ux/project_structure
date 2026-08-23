/**
 * De ONDE o preço resolvido veio (§3.2 do 02A) — a prioridade da resolução, de cima para baixo:
 *  - `item_negotiated`: preço digitado na linha do pedido (resolvido no build do item, não aqui);
 *  - `contact_list`: tabela vinculada ao CONTATO;
 *  - `sales_rep_list`: tabela vinculada ao VENDEDOR;
 *  - `base`: preço base do produto (fallback final).
 *
 * Canal/PDV (`channel_list`, `pdv_list`) são rungs futuros (CAN/PDV) — reservados aqui, não
 * resolvidos no V1.
 */
export const PRICE_SOURCES = [
  'item_negotiated',
  'contact_list',
  'sales_rep_list',
  'channel_list',
  'pdv_list',
  'base',
] as const;

export type PriceSource = (typeof PRICE_SOURCES)[number];
