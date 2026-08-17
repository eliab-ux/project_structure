import { DomainException } from '@gitspread/domain-primitives';

export class FabricNotFoundException extends DomainException {
  constructor() {
    super('Tecido não encontrado.');
  }
}

export class ProductTypeNotFoundException extends DomainException {
  constructor() {
    super('Tipo de produto não encontrado.');
  }
}

/**
 * Nome repetido dentro da conta.
 *
 * A unicidade não está na spec e existe porque a §4.5 chama a altura máxima de "coração da
 * estimativa": dois tecidos "Malha" com alturas diferentes tornam ambígua justamente a decisão
 * que precisa ser exata. O mesmo vale para tipo de produto no relatório mensal.
 */
export class CatalogNameAlreadyInUseException extends DomainException {
  constructor(what: 'tecido' | 'tipo de produto') {
    super(`Já existe um ${what} com este nome.`);
  }
}
