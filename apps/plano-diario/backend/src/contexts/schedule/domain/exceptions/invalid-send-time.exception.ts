import { DomainException } from '@gitspread/domain-primitives';

export class InvalidSendTimeException extends DomainException {
  constructor() {
    super('Horário de envio inválido (use HH:mm, entre 00:00 e 23:59)');
  }
}
