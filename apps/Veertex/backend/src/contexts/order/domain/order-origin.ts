/**
 * Origem do pedido (§3.3 do 02, decidido 22/08/2026) — para o card "pedidos por origem" (§3.8 CORE).
 *
 * Enum **aberto**, começando pelas origens que NÃO dependem do CAN (canais de venda): `loja_virtual`
 * e `marketplace` entram quando o CAN existir. Aberto como o `format` do produto: o valor não é
 * recusado quando o canal chegar, evitando migração de enum.
 */
export const ORDER_ORIGINS = ['balcao', 'representante', 'telefone', 'importacao'] as const;

export type OrderOrigin = (typeof ORDER_ORIGINS)[number];

export const ORDER_ORIGIN_LABEL: Record<string, string> = {
  balcao: 'Balcão',
  representante: 'Representante',
  telefone: 'Telefone',
  importacao: 'Importação',
};
