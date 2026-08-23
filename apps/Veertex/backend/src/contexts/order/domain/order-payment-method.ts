/**
 * Forma de pagamento de um `order_payment` (§4.1 do 02A). Mais larga que a condição nomeada
 * (§4.2): aqui é o MEIO concreto (dinheiro, cartão, pix...), lá é o cadastro nomeado reutilizável.
 *
 * `pagamento misto` (dinheiro + cartão na mesma venda) é N linhas destas por pedido — por isso é uma
 * tabela filha, não um campo do pedido.
 */
export const ORDER_PAYMENT_METHODS = [
  'dinheiro',
  'cartao_credito',
  'cartao_debito',
  'pix',
  'boleto',
  'cheque',
  'promissoria',
  'outro',
] as const;

export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

export const ORDER_PAYMENT_METHOD_LABEL: Record<OrderPaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  pix: 'Pix',
  boleto: 'Boleto',
  cheque: 'Cheque',
  promissoria: 'Promissória',
  outro: 'Outro',
};
