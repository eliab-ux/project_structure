import { DomainException } from '@gitspread/domain-primitives';

/**
 * O grupo não está no cache do usuário. Usado como barreira de autorização: um JID arbitrário
 * enviado no body nunca vira destino de mensagem sem passar por aqui.
 */
export class GroupNotFoundException extends DomainException {
  constructor() {
    super('Grupo não encontrado entre os grupos do seu WhatsApp');
  }
}
