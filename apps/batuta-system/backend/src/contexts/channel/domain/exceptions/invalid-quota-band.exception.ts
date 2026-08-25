import { DomainException } from '@gitspread/domain-primitives';

export class InvalidQuotaBandException extends DomainException {
  constructor() {
    super('Faixa de cota inválida: piso deve ser maior que zero e teto maior ou igual ao piso.');
  }
}
