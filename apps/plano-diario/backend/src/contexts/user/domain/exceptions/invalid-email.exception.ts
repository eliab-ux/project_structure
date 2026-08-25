import { DomainException } from '@gitspread/domain-primitives';

export class InvalidEmailException extends DomainException {
  constructor() {
    // Sem ecoar o valor recebido — evita refletir input do cliente na resposta.
    super('E-mail inválido');
  }
}
