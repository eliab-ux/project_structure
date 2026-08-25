import { DomainException } from '@gitspread/domain-primitives';

export class WhatsappInstanceNotFoundException extends DomainException {
  constructor() {
    super('Nenhum WhatsApp conectado nesta conta');
  }
}
