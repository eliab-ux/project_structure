/**
 * Direção do título financeiro (§3 do 05): a receber ou a pagar. Uma tabela `financial_titles` com
 * direção, em vez de duas tabelas — o ciclo de baixa é o mesmo dos dois lados.
 */
export const TITLE_DIRECTIONS = ['receivable', 'payable'] as const;
export type TitleDirection = (typeof TITLE_DIRECTIONS)[number];

/**
 * Situação do título (§2.1 do 05). `open → partial → settled` (baixa parcial deixa saldo no MESMO
 * título), mais `renegotiated` e `written_off_pending/written_off` (política "perdida" do 04 §3.4 —
 * reservadas no enum; a transição chega com a fatia da COB/ROT). A situação é DERIVADA do somatório
 * das baixas; não é um campo que se edita à mão.
 */
export const TITLE_STATUSES = [
  'open',
  'partial',
  'settled',
  'renegotiated',
  'written_off_pending',
  'written_off',
] as const;
export type TitleStatus = (typeof TITLE_STATUSES)[number];

/**
 * Origem do título (§2.1/§2.2 do 05). No V1 nasce do lançamento MANUAL; `invoicing` (faturamento) e
 * `consignment` (ciclo do ROT) e `commission` (apuração → conta a pagar) entram quando os módulos
 * donos ligarem — reservados no enum para o schema não migrar depois.
 */
export const TITLE_ORIGINS = [
  'manual',
  'invoicing',
  'consignment',
  'commission',
  'renegotiation',
] as const;
export type TitleOrigin = (typeof TITLE_ORIGINS)[number];
