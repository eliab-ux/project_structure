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
