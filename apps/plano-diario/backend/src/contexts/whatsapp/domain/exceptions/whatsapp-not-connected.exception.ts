import { DomainException } from '@gitspread/domain-primitives';

export class WhatsappNotConnectedException extends DomainException {
  constructor() {
    super('O WhatsApp não está conectado');
  }
}
