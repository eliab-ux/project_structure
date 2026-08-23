import { DomainException } from '@gitspread/domain-primitives';

export class FinancialAccountNotFoundException extends DomainException {
  constructor() {
    super('Conta financeira não encontrada.');
  }
}

export class FinancialCategoryNotFoundException extends DomainException {
  constructor() {
    super('Categoria financeira não encontrada.');
  }
}

export class FinancialTitleNotFoundException extends DomainException {
  constructor() {
    super('Título financeiro não encontrado.');
  }
}

/** Baixa cujo principal excede o saldo em aberto (§2.1 do 05) — baixa não vira crédito. */
export class TitleOverSettlementException extends DomainException {
  constructor(open: string, principal: string) {
    super(`Baixa de ${principal} excede o saldo em aberto do título (${open}).`);
  }
}

export class TitleClosedException extends DomainException {
  constructor() {
    super('Título já quitado: não aceita nova baixa.');
  }
}

/** Operação de baixa/crédito com valor ou estado inválido — erro de negócio, mensagem segura. */
export class InvalidSettlementException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
