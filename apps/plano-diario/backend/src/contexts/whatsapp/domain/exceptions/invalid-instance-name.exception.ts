import { DomainException } from '@gitspread/domain-primitives';

export class InvalidInstanceNameException extends DomainException {
  constructor() {
    super('Não foi possível derivar o nome da instância do WhatsApp');
  }
}
