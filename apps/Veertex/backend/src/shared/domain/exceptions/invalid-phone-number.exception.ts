import { DomainException } from '@veertex/domain-primitives';

export class InvalidPhoneNumberException extends DomainException {
  constructor() {
    // No echo of the offending value: it is personal data heading for a log line.
    super('Número de WhatsApp inválido. Informe DDD + número (ex.: 62 99999-9999).');
  }
}
