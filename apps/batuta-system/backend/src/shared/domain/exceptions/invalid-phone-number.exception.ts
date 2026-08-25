import { DomainException } from '@gitspread/domain-primitives';

export class InvalidPhoneNumberException extends DomainException {
  constructor() {
    super('Número de telefone inválido. Use o formato E.164 (ex.: +5511999999999).');
  }
}
