import { DomainException } from '@gitspread/domain-primitives';

/**
 * Saída deixaria o saldo negativo, e a conta não permite (§3.2 do 03).
 *
 * Bloqueio é o default (preferência `stock_allow_negative` desligada) — evita vender o que não
 * existe. A mensagem nomeia o disponível e o pedido, para ser acionável.
 */
export class NegativeStockNotAllowedException extends DomainException {
  constructor(available: string, requested: string) {
    super(`Saldo insuficiente: disponível ${available}, saída de ${requested}.`);
  }
}

export class InvalidMovementQuantityException extends DomainException {
  constructor() {
    super('A quantidade do movimento deve ser diferente de zero.');
  }
}

export class StockProductInvalidException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

/** Movimento de origem (venda) não encontrado para uma devolução que o referencia. */
export class OriginMovementNotFoundException extends DomainException {
  constructor() {
    super('O movimento de origem da devolução não foi encontrado.');
  }
}

/**
 * Reserva pedida acima do DISPONÍVEL (§3.9). A mensagem nomeia o produto e o quanto falta — é o que
 * decide se o pedido pode ser confirmado, então precisa ser acionável (vem do backend, §pedido).
 */
export class NotEnoughAvailableException extends DomainException {
  constructor(productName: string, available: string, requested: string) {
    super(
      `Disponível insuficiente de "${productName}": disponível ${available}, reserva de ${requested}.`,
    );
  }
}
