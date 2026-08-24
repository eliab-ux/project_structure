import { DomainException } from '@gitspread/domain-primitives';

export class OrderNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Pedido ${id} não encontrado.`);
  }
}

/** Pedido sem itens não pode ser confirmado — não há o que vender. */
export class EmptyOrderException extends DomainException {
  constructor() {
    super('O pedido não tem itens.');
  }
}

/**
 * Limite de crédito do contato estourado (§2.2 do 02 / §3.4 do CORE: "bloqueia venda acima").
 *
 * V1: compara o total DESTE pedido com o limite. O crédito acumulado (soma dos títulos em aberto)
 * chega com FIN/COB — até lá, o bloqueio é por pedido, e a mensagem nomeia limite e excedente.
 */
export class CreditLimitExceededException extends DomainException {
  constructor(limit: string, total: string) {
    super(
      `Venda acima do limite de crédito do contato. Limite: ${limit}; total do pedido: ${total}.`,
    );
  }
}

export class InvalidStatusTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(`Transição de situação inválida: de "${from}" para "${to}".`);
  }
}

/**
 * Faturamento pedido no V1 — bloqueado LOUD, não silencioso.
 *
 * Faturar exige baixa (EST), título (FIN) e NF-e (FIS), que não existem. Aceitar a transição faria o
 * pedido "faturado" sem nada faturado de fato — pior que a recusa clara. Some quando os módulos
 * existirem.
 */
export class InvoicingNotAvailableException extends DomainException {
  constructor() {
    super('Faturar depende dos módulos de Estoque, Financeiro e Fiscal, que ainda não existem.');
  }
}

/** Desconto sem a permissão `orders.discount.grant` (§3.5 do 02). */
export class DiscountNotAllowedException extends DomainException {
  constructor() {
    super('Este usuário não pode conceder desconto.');
  }
}

export class OrderCompanyRequiredException extends DomainException {
  constructor() {
    super('O pedido precisa de uma empresa (CNPJ).');
  }
}

export class OrderCustomerInvalidException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

export class OrderProductInvalidException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

/** Pagamento (§4.1 do 02A) com valor não-positivo. */
export class InvalidPaymentAmountException extends DomainException {
  constructor() {
    super('O valor do pagamento deve ser maior que zero.');
  }
}

/** Ciclo consignado (§3.1 do 04) só existe para pedido de ROTA. */
export class NotAConsignmentOrderException extends DomainException {
  constructor(origin: string) {
    super(`O ciclo de consignação é exclusivo de pedidos de rota (origem atual: "${origin}").`);
  }
}

/**
 * Bloqueio por inadimplência (06 §2.5): cliente com título vencido além do limite da conta não
 * compra de novo — a mensagem nomeia o valor e a idade, e diz qual permissão libera a exceção.
 */
export class OverdueCustomerException extends DomainException {
  constructor(overdueAmount: string, days: number) {
    super(
      `Cliente com R$ ${overdueAmount} vencidos há mais de ${days} dia(s). ` +
        'Venda bloqueada pela política da conta; a exceção exige a permissão orders.overdue.override.',
    );
  }
}
