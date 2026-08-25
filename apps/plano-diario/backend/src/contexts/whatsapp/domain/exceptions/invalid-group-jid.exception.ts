import { DomainException } from '@gitspread/domain-primitives';

export class InvalidGroupJidException extends DomainException {
  constructor() {
    // Sem ecoar o valor: ele vem do cliente e não deve ser refletido na resposta.
    super('Identificador de grupo do WhatsApp inválido');
  }
}
