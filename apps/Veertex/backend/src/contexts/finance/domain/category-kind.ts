/**
 * Natureza da categoria financeira (§2.4 do 05). `revenue` (receita), `expense` (despesa) e
 * `neutral` — a categoria "transferência" entre contas, que **não é receita nem despesa** e jamais
 * infla resultado (lição da árvore real absorvida).
 */
export const CATEGORY_KINDS = ['revenue', 'expense', 'neutral'] as const;

export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/**
 * Operação para a qual a categoria é o PADRÃO (§2.4): venda→faturamento, compra→custo,
 * comissão→despesa comercial, tarifa bancária por evento, frete, imposto, transferência (neutra).
 * `null` = categoria comum, sem papel de default. Um valor de operação aparece em no máximo uma
 * categoria por conta (o default é único).
 */
export const CATEGORY_OPERATIONS = [
  'sale',
  'purchase',
  'commission',
  'bank_fee',
  'freight',
  'tax',
  'transfer',
] as const;

export type CategoryOperation = (typeof CATEGORY_OPERATIONS)[number];
