import { DomainException } from '@gitspread/domain-primitives';

export class InvalidTimezoneException extends DomainException {
  constructor() {
    super('Fuso horário inválido (use um identificador IANA, ex.: America/Sao_Paulo)');
  }
}
