import { DomainException } from '@gitspread/domain-primitives';

export class PriceListNotFoundException extends DomainException {
  constructor() {
    super('Tabela de preço não encontrada.');
  }
}

/** Não há preço resolvível: nenhuma tabela cobre e o produto não tem preço base. */
export class PriceNotResolvableException extends DomainException {
  constructor(productName: string) {
    super(`Sem preço para "${productName}": nenhuma tabela cobre e o produto não tem preço base.`);
  }
}
