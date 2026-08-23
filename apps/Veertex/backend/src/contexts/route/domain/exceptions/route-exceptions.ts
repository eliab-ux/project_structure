import { DomainException } from '@gitspread/domain-primitives';

export class RouteNotFoundException extends DomainException {
  constructor() {
    super('Rota não encontrada.');
  }
}

export class TripNotFoundException extends DomainException {
  constructor() {
    super('Viagem não encontrada.');
  }
}

export class InvalidTripTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(`Transição de viagem inválida: ${from} → ${to}.`);
  }
}

/** Carga (romaneio) só entra com a viagem PLANEJADA (§3.1 do 04). */
export class TripNotOpenForCargoException extends DomainException {
  constructor(status: string) {
    super(`A viagem não aceita carga na situação "${status}" — só em "planejada".`);
  }
}

/** A viagem é de OUTRA empresa/rota do que o pedido/carga referencia. */
export class TripMismatchException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

/** Efetivar duas vezes efetivaria a baixa duas vezes (§3.3 do 04). */
export class FieldReceiptAlreadyEffectuatedException extends DomainException {
  constructor() {
    super('Recebimento já efetivado.');
  }
}

export class FieldReceiptNotFoundException extends DomainException {
  constructor() {
    super('Recebimento não encontrado.');
  }
}

/** GPS da abertura já capturado — recapturar é proibido; alterar é o ChangeOrderGps auditado. */
export class GpsAlreadyCapturedException extends DomainException {
  constructor() {
    super('O GPS da abertura já foi capturado — alteração só por ação explícita auditada.');
  }
}

export class GpsNotCapturedException extends DomainException {
  constructor() {
    super('O pedido não tem GPS capturado.');
  }
}

/** 1 promissória por pedido (§3.1 do 04). 2ª via = reimprimir a existente, nunca gerar outra. */
export class PromissoryAlreadyExistsException extends DomainException {
  constructor() {
    super('O pedido já tem promissória — reimprima a existente (2ª via), não gere outra.');
  }
}
