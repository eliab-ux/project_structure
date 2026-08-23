/**
 * Os tipos de condição de pagamento (§4.2 do 02A). A lista veio direto do levantamento:
 * promissória, à vista, cartão, cheque pré-datado, Pix, boleto.
 *
 * O tipo é o que o pagamento (order_payment, §4.1) referencia; a DATA do cheque pré-datado vive no
 * pagamento, não na condição — a condição é o cadastro nomeado reutilizável.
 */
export const PAYMENT_CONDITION_KINDS = [
  'promissoria',
  'a_vista',
  'cartao',
  'cheque_pre',
  'pix',
  'boleto',
] as const;

export type PaymentConditionKind = (typeof PAYMENT_CONDITION_KINDS)[number];

export const PAYMENT_CONDITION_KIND_LABEL: Record<PaymentConditionKind, string> = {
  promissoria: 'Promissória',
  a_vista: 'À vista',
  cartao: 'Cartão',
  cheque_pre: 'Cheque pré-datado',
  pix: 'Pix',
  boleto: 'Boleto',
};

export function isPaymentConditionKind(value: string): value is PaymentConditionKind {
  return (PAYMENT_CONDITION_KINDS as readonly string[]).includes(value);
}
